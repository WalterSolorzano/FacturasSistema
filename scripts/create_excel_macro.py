#!/usr/bin/env python3
"""
CUCIMUNDO - Generador de Excel con Macro (.xlsm)
Crea un archivo Excel listo para usar con:
  - Hoja "BaseDeDatos": registro de todas las facturas
  - Hoja "Plantilla": formulario para ingresar facturas
  - Boton "Guardar Factura": macro que duplica la hoja y registra en BD
  - Boton "Buscar": macro para buscar facturas
"""

import struct
import io
import os
import zipfile
import copy
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# ============================================================
# COLORES CUCIMUNDO (morado oscuro)
# ============================================================
MORADO = "5B21B6"       # primary dark purple
MORADO_OSCURO = "3B0764" # darker purple
MORADO_MEDIO = "7C3AED"  # medium purple
MORADO_CLARO = "EDE9FE"  # light purple bg
MORADO_SUAVE = "F5F3FF"  # very light purple
BLANCO = "FFFFFF"
GRIS = "6B7280"
GRIS_CLARO = "F3F4F6"
GRIS_BORDE = "D1D5DB"
NEGRO = "1F2937"
VERDE_OK = "059669"
ROJO_ERR = "DC2626"

# Common styles
font_title = Font(name="Calibri", size=14, bold=True, color=BLANCO)
font_header = Font(name="Calibri", size=10, bold=True, color=BLANCO)
font_normal = Font(name="Calibri", size=10, color=NEGRO)
font_small = Font(name="Calibri", size=9, color=GRIS)
font_bold = Font(name="Calibri", size=10, bold=True, color=NEGRO)
font_purple = Font(name="Calibri", size=10, bold=True, color=MORADO)
font_link = Font(name="Calibri", size=10, color=MORADO_MEDIO, underline="single")

fill_purple = PatternFill("solid", fgColor=MORADO)
fill_dark = PatternFill("solid", fgColor=MORADO_OSCURO)
fill_medium = PatternFill("solid", fgColor=MORADO_MEDIO)
fill_light = PatternFill("solid", fgColor=MORADO_CLARO)
fill_soft = PatternFill("solid", fgColor=MORADO_SUAVE)
fill_white = PatternFill("solid", fgColor=BLANCO)
fill_gray = PatternFill("solid", fgColor=GRIS_CLARO)
fill_green = PatternFill("solid", fgColor="ECFDF5")

align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
align_right = Alignment(horizontal="right", vertical="center")
align_input = Alignment(horizontal="left", vertical="center")

thin_border = Border(
    left=Side(style="thin", color=GRIS_BORDE),
    right=Side(style="thin", color=GRIS_BORDE),
    top=Side(style="thin", color=GRIS_BORDE),
    bottom=Side(style="thin", color=GRIS_BORDE),
)

def apply_cell(ws, row, col, value, font=font_normal, fill=None, alignment=align_left, border=None, number_format=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = font
    if fill: cell.fill = fill
    cell.alignment = alignment
    if border: cell.border = border
    if number_format: cell.number_format = number_format
    return cell

def apply_border_range(ws, min_row, max_row, min_col, max_col, border=thin_border):
    for r in range(min_row, max_row + 1):
        for c in range(min_col, max_col + 1):
            ws.cell(row=r, column=c).border = border


# ============================================================
# 1. CREATE EXCEL WORKBOOK WITH OPENPYXL
# ============================================================
def create_workbook():
    wb = Workbook()

    # ===== HOJA: BASE DE DATOS =====
    ws_bd = wb.active
    ws_bd.title = "BaseDeDatos"
    ws_bd.sheet_properties.tabColor = MORADO

    # Title row
    ws_bd.merge_cells("A1:I1")
    apply_cell(ws_bd, 1, 1, "BASE DE DATOS - FACTURAS CUCIMUNDO", font_title, fill_purple, align_center)
    ws_bd.row_dimensions[1].height = 38

    # Subtitle
    ws_bd.merge_cells("A2:I2")
    apply_cell(ws_bd, 2, 1, "Registro automatico de facturas  |  CUCIMUNDO", font_small, fill_light, align_center)
    ws_bd.row_dimensions[2].height = 22

    # Headers
    headers_bd = ["N\u00b0 Factura", "Tipo", "Fecha", "Codigo", "Descripcion",
                  "Cantidad", "P.Unitario", "Subtotal", "Total Factura"]
    col_widths_bd = [20, 7, 13, 12, 45, 11, 14, 14, 16]

    for i, (h, w) in enumerate(zip(headers_bd, col_widths_bd), 1):
        ws_bd.column_dimensions[get_column_letter(i)].width = w
        apply_cell(ws_bd, 3, i, h, font_header, fill_dark, align_center, thin_border)
    ws_bd.row_dimensions[3].height = 26

    # Auto-filter
    ws_bd.auto_filter.ref = "A3:I1000"

    # Freeze panes
    ws_bd.freeze_panes = "A4"

    # Pre-format rows 4-1000 with alternating colors and borders
    for r in range(4, 501):
        fill = fill_soft if r % 2 == 0 else fill_white
        for c in range(1, 10):
            cell = ws_bd.cell(row=r, column=c)
            cell.font = font_normal
            cell.fill = fill
            cell.border = thin_border
            if c == 1:
                cell.alignment = align_left
            elif c in (6, 7, 8, 9):
                cell.alignment = align_right
                cell.number_format = '#,##0.00'
            elif c == 3:
                cell.alignment = align_center
            else:
                cell.alignment = align_left

    # ===== HOJA: PLANTILLA =====
    ws_pl = wb.create_sheet("Plantilla")
    ws_pl.sheet_properties.tabColor = MORADO_MEDIO

    # Column widths for template
    widths_pl = {1: 3, 2: 18, 3: 20, 4: 3, 5: 14, 6: 14, 7: 14, 8: 14, 9: 3}
    for c, w in widths_pl.items():
        ws_pl.column_dimensions[get_column_letter(c)].width = w

    # Row 1: Title
    ws_pl.merge_cells("B1:H1")
    apply_cell(ws_pl, 1, 2, "CUCIMUNDO - FACTURA", Font(name="Calibri", size=16, bold=True, color=BLANCO), fill_purple, align_center)
    ws_pl.row_dimensions[1].height = 40

    # Row 2: Subtitle
    ws_pl.merge_cells("B2:H2")
    apply_cell(ws_pl, 2, 2, "Complete los datos y presione Guardar Factura", font_small, fill_light, align_center)
    ws_pl.row_dimensions[2].height = 20

    # Row 3: N Factura
    apply_cell(ws_pl, 4, 2, "N\u00b0 Factura:", font_bold, fill_soft, Alignment(horizontal="right", vertical="center"), thin_border)
    apply_cell(ws_pl, 4, 3, None, font_normal, fill_white, align_input, thin_border)
    ws_pl.merge_cells("C4:E4")

    # Row 4: Tipo
    apply_cell(ws_pl, 4, 6, "Tipo:", font_bold, fill_soft, Alignment(horizontal="right", vertical="center"), thin_border)
    apply_cell(ws_pl, 4, 7, "FC", font_normal, fill_white, align_center, thin_border)
    dv_tipo = DataValidation(type="list", formula1='"FC,FA,FB,FM,FT,NC,ND"', allow_blank=True)
    dv_tipo.error = "Seleccione un tipo valido"
    dv_tipo.errorTitle = "Tipo invalido"
    ws_pl.add_data_validation(dv_tipo)
    dv_tipo.add(ws_pl["G4"])

    # Row 5: Fecha
    apply_cell(ws_pl, 5, 2, "Fecha:", font_bold, fill_soft, Alignment(horizontal="right", vertical="center"), thin_border)
    celda_fecha = apply_cell(ws_pl, 5, 3, None, font_normal, fill_white, align_center, thin_border)
    ws_pl.merge_cells("C5:E5")
    dv_fecha = DataValidation(type="date", allow_blank=True)
    dv_fecha.prompt = "Ingrese fecha (DD/MM/AAAA)"
    dv_fecha.promptTitle = "Fecha"
    ws_pl.add_data_validation(dv_fecha)
    dv_fecha.add(ws_pl["C5"])

    # Row 5 right: empty
    apply_cell(ws_pl, 5, 6, "", font_normal, fill_white, None, None)
    apply_cell(ws_pl, 5, 7, "", font_normal, fill_white, None, None)

    # Row 6: Razon Social
    apply_cell(ws_pl, 6, 2, "Razon Social:", font_bold, fill_soft, Alignment(horizontal="right", vertical="center"), thin_border)
    apply_cell(ws_pl, 6, 3, None, font_normal, fill_white, align_input, thin_border)
    ws_pl.merge_cells("C6:H6")

    # Row 7: CUIT
    apply_cell(ws_pl, 7, 2, "CUIT:", font_bold, fill_soft, Alignment(horizontal="right", vertical="center"), thin_border)
    apply_cell(ws_pl, 7, 3, None, font_normal, fill_white, align_input, thin_border)
    ws_pl.merge_cells("C7:E7")

    # Row 7 right: Condicion de pago
    apply_cell(ws_pl, 7, 6, "Pago:", font_bold, fill_soft, Alignment(horizontal="right", vertical="center"), thin_border)
    apply_cell(ws_pl, 7, 7, None, font_normal, fill_white, align_input, thin_border)
    ws_pl.merge_cells("G7:H7")

    # Row 8: Direccion
    apply_cell(ws_pl, 8, 2, "Direccion:", font_bold, fill_soft, Alignment(horizontal="right", vertical="center"), thin_border)
    apply_cell(ws_pl, 8, 3, None, font_normal, fill_white, align_input, thin_border)
    ws_pl.merge_cells("C8:H8")

    # Row 9: separator
    ws_pl.merge_cells("B9:H9")
    apply_cell(ws_pl, 9, 2, "", font_normal, fill_purple, align_center)
    ws_pl.row_dimensions[9].height = 4

    # Row 10: Item headers
    item_headers = [("Cantidad", 5), ("Codigo", 2), ("Descripcion", 4),
                    ("P.Unitario", 7), ("Subtotal", 8)]
    for label, col in item_headers:
        apply_cell(ws_pl, 10, col, label, font_header, fill_dark, align_center, thin_border)
    ws_pl.row_dimensions[10].height = 26

    # Rows 11-40: Item entry rows
    for r in range(11, 41):
        fill = fill_soft if r % 2 == 0 else fill_white
        # Cantidad (col 5)
        apply_cell(ws_pl, r, 5, None, font_normal, fill, align_right, thin_border, '#,##0')
        # Codigo (col 2)
        apply_cell(ws_pl, r, 2, None, font_normal, fill, align_left, thin_border)
        # Descripcion (col 4) - merge C-E doesn't work, just use col 4 with wider
        apply_cell(ws_pl, r, 4, None, font_normal, fill, align_left, thin_border)
        ws_pl.merge_cells(f"D{r}:F{r}")
        # P.Unitario (col 7)
        apply_cell(ws_pl, r, 7, None, font_normal, fill, align_right, thin_border, '#,##0.00')
        # Subtotal (col 8) - formula
        cell_sub = apply_cell(ws_pl, r, 8, None, font_normal, fill, align_right, thin_border, '#,##0.00')
        cell_sub.value = f'=IF(AND(E{r}<>"",G{r}<>""),E{r}*G{r},"")'

    # Row 42: Total
    ws_pl.merge_cells("B42:F42")
    apply_cell(ws_pl, 42, 2, "TOTAL GENERAL", font_title, fill_purple, Alignment(horizontal="right", vertical="center"))
    ws_pl.row_dimensions[42].height = 32
    apply_cell(ws_pl, 42, 7, None, Font(name="Calibri", size=14, bold=True, color=MORADO_OSCURO), fill_light, align_right, thin_border, '#,##0.00')
    ws_pl["G42"].value = '=SUMPRODUCT((E11:E40<>"")*H11:H40)'
    ws_pl.merge_cells("G42:H42")

    # Row 44: Instructions
    ws_pl.merge_cells("B44:H44")
    apply_cell(ws_pl, 44, 2,
               "Instrucciones: 1) Complete los datos arriba  2) Ingrese los items  3) Presione el boton Guardar Factura",
               Font(name="Calibri", size=9, italic=True, color=GRIS), fill_white, align_center)

    # Set print area and page setup for template
    ws_pl.sheet_properties.pageSetUpPr = None
    ws_pl.print_area = "A1:I44"

    # ===== HOJA: INSTRUCCIONES =====
    ws_ins = wb.create_sheet("Instrucciones")
    ws_ins.sheet_properties.tabColor = "9CA3AF"
    ws_ins.column_dimensions["A"].width = 4
    ws_ins.column_dimensions["B"].width = 70

    instructions = [
        ("CUCIMUNDO - Sistema de Facturas en Excel", True, "FF" + MORADO),
        ("", False, "FF" + BLANCO),
        ("COMO USAR ESTE ARCHIVO", True, "FF" + MORADO_OSCURO),
        ("", False, "FF" + BLANCO),
        ("1. Hoja 'Plantilla': Ahi se ingresan los datos de cada factura.", False, "FF" + NEGRO),
        ("   - Complete el numero de factura, fecha, razon social y CUIT.", False, "FF" + GRIS),
        ("   - Ingrese los productos en la tabla (cantidad, codigo, descripcion, precio).", False, "FF" + GRIS),
        ("   - El subtotal se calcula automaticamente.", False, "FF" + GRIS),
        ("", False, "FF" + BLANCO),
        ("2. Boton 'Guardar Factura':", False, "FF" + NEGRO),
        ("   - Crea una copia de la plantilla como nueva hoja con los datos.", False, "FF" + GRIS),
        ("   - Registra los items en la hoja 'BaseDeDatos'.", False, "FF" + GRIS),
        ("   - Limpia la plantilla para la proxima factura.", False, "FF" + GRIS),
        ("", False, "FF" + BLANCO),
        ("3. Boton 'Buscar Factura':", False, "FF" + NEGRO),
        ("   - Permite buscar por numero de factura, codigo o descripcion.", False, "FF" + GRIS),
        ("   - Muestra los resultados encontrados en la Base de Datos.", False, "FF" + GRIS),
        ("", False, "FF" + BLANCO),
        ("4. Hoja 'BaseDeDatos':", False, "FF" + NEGRO),
        ("   - Aqui se registran automaticamente todas las facturas.", False, "FF" + GRIS),
        ("   - Puede filtrar por columna usando las flechas del encabezado.", False, "FF" + GRIS),
        ("   - Puede ordenar haciendo clic en los encabezados.", False, "FF" + GRIS),
        ("", False, "FF" + BLANCO),
        ("NOTA: Al abrir este archivo, Excel puede pedir que habilite las macros.", True, "FF" + ROJO_ERR),
        ("Debe hacer clic en 'Habilitar contenido' para que los botones funcionen.", True, "FF" + ROJO_ERR),
    ]

    for i, (text, bold, color) in enumerate(instructions, 1):
        f = Font(name="Calibri", size=11 if bold else 10, bold=bold, color=color if color else "FF000000")
        apply_cell(ws_ins, i, 2, text, f)

    return wb


# ============================================================
# 2. BUILD VBA PROJECT BINARY (OLE Compound Document)
# ============================================================

class OleCompoundDoc:
    """Creates a minimal OLE Compound Document (CFBF) from scratch."""

    ENDOFCHAIN = 0xFFFFFFFE
    FREESECT = 0xFFFFFFFF
    FATSECT = 0xFFFFFFFD
    DIFSECT = 0xFFFFFFFC
    SECTOR_SIZE = 512
    MINI_SECTOR_SIZE = 64
    DIR_ENTRY_SIZE = 128

    def __init__(self):
        self.streams = {}  # path (tuple) -> bytes
        self.storages = set()  # paths that are storages

    def add_storage(self, path):
        self.storages.add(path)

    def add_stream(self, path, data):
        self.streams[path] = data

    def build(self):
        entries = []  # (name, type, left, right, child, data)
        # Entry 0: Root Entry
        entries.append(("Root Entry", 5, -1, -1, 1, b""))
        # Entry 1: \x01VBA storage
        entries.append(("\x01VBA", 1, -1, -1, 2, b""))

        # Collect and sort streams
        vba_streams = []
        for path, data in self.streams.items():
            name = path[0] if isinstance(path, tuple) and len(path) == 1 else path
            vba_streams.append((name, data))
        vba_streams.sort(key=lambda x: x[0])

        # Entry 2+: streams under \x01VBA (child of entry 1)
        for i, (name, data) in enumerate(vba_streams):
            idx = 2 + i
            left = idx - 1 if i > 0 else -1
            right = idx + 1 if i < len(vba_streams) - 1 else -1
            entries.append((name, 2, left, right, -1, data))

        num_entries = len(entries)
        dir_sectors = max(1, (num_entries * self.DIR_ENTRY_SIZE + self.SECTOR_SIZE - 1) // self.SECTOR_SIZE)

        # Allocate sectors
        # Layout: [FAT sector(s)] [Directory sector(s)] [Stream data sectors] [Mini FAT sector] [Mini stream container]
        fat_sectors = 1  # We'll keep it to 1 FAT sector (128 entries, supports up to ~65000 bytes)
        total_entries_in_fat = fat_sectors * self.SECTOR_SIZE // 4

        sector_map = []  # sector_index -> (type, data_or_ref)
        # Sector 0: FAT
        sector_map.append(("fat", None))
        # Sectors 1..1+dir_sectors-1: Directory
        for i in range(dir_sectors):
            sector_map.append(("dir", None))

        # Allocate stream data sectors
        stream_sector_map = {}  # entry_index -> [sector_indices]
        for idx in range(num_entries):
            data = entries[idx][5]
            if len(data) == 0:
                continue
            # If data >= mini_stream_cutoff, use regular sectors
            # Otherwise, use mini stream
            if len(data) >= 4096:
                sectors_needed = (len(data) + self.SECTOR_SIZE - 1) // self.SECTOR_SIZE
                start = len(sector_map)
                for _ in range(sectors_needed):
                    sector_map.append(("stream", idx))
                stream_sector_map[idx] = list(range(start, start + sectors_needed))
            # Mini stream data handled separately

        # Mini FAT sector
        mini_fat_sector = len(sector_map)
        sector_map.append(("minifat", None))

        # Mini stream container sector
        mini_stream_sector = len(sector_map)
        sector_map.append(("ministream", None))

        total_sectors = len(sector_map)

        # Build FAT
        fat = [self.FREESECT] * (self.SECTOR_SIZE // 4)
        fat[0] = self.FATSECT  # FAT sector
        for i in range(1, 1 + dir_sectors):
            fat[i] = self.ENDOFCHAIN if i == 1 + dir_sectors - 1 else i + 1
        # Stream sectors
        for idx, sectors in stream_sector_map.items():
            for j, s in enumerate(sectors):
                fat[s] = self.ENDOFCHAIN if j == len(sectors) - 1 else sectors[j + 1]
        fat[mini_fat_sector] = self.ENDOFCHAIN
        fat[mini_stream_sector] = self.ENDOFCHAIN

        # Build directory entries
        directory = bytearray()
        for i, (name, obj_type, left, right, child, data) in enumerate(entries):
            entry = bytearray(self.DIR_ENTRY_SIZE)
            name_bytes = name.encode("utf-16-le")
            entry[0:len(name_bytes)] = name_bytes
            struct.pack_into("<H", entry, 64, len(name_bytes) + 2)
            entry[66] = obj_type  # 0=empty, 1=storage, 2=stream, 5=root
            entry[67] = 1  # black
            struct.pack_into("<i", entry, 68, left if left >= 0 else -1)
            struct.pack_into("<i", entry, 72, right if right >= 0 else -1)
            struct.pack_into("<i", entry, 76, child if child >= 0 else -1)
            # start sector and size
            if i == 0:
                # Root: mini stream container
                struct.pack_into("<I", entry, 116, mini_stream_sector)
                # mini stream size calculated below
            elif i in stream_sector_map:
                struct.pack_into("<I", entry, 116, stream_sector_map[i][0])
                struct.pack_into("<I", entry, 120, len(data))
            elif i > 1 and len(entries[i][5]) > 0:
                # Mini stream entry - sector and offset stored in mini FAT
                pass
            directory += entry

        # Pad directory to full sectors
        while len(directory) < dir_sectors * self.SECTOR_SIZE:
            directory += b"\x00"

        # Build mini FAT
        mini_fat = [self.FREESECT] * (self.SECTOR_SIZE // 4)

        # Build mini stream (all streams < 4096 bytes)
        mini_stream = bytearray()
        mini_sector_alloc = {}
        for i, (name, obj_type, left, right, child, data) in enumerate(entries):
            if i == 0 or len(data) == 0 or i in stream_sector_map:
                continue
            # This is a mini stream
            start_mini = len(mini_stream) // self.MINI_SECTOR_SIZE
            sectors_needed = (len(data) + self.MINI_SECTOR_SIZE - 1) // self.MINI_SECTOR_SIZE
            for j in range(sectors_needed - 1):
                mini_fat[start_mini + j] = start_mini + j + 1
            mini_fat[start_mini + sectors_needed - 1] = self.ENDOFCHAIN
            mini_sector_alloc[i] = (start_mini, len(data))
            mini_stream += data
            while len(mini_stream) % self.MINI_SECTOR_SIZE != 0:
                mini_stream += b"\x00"

        # Update root entry with mini stream size
        struct.pack_into("<I", directory, 116 + 120, len(mini_stream))

        # Update mini stream entries with their start sector
        for i, (start_mini, size) in mini_sector_alloc.items():
            offset = i * self.DIR_ENTRY_SIZE
            struct.pack_into("<I", directory, offset + 116, start_mini)
            struct.pack_into("<I", directory, offset + 120, size)

        # Pad mini stream to sector size
        while len(mini_stream) % self.SECTOR_SIZE != 0:
            mini_stream += b"\x00"
        if len(mini_stream) == 0:
            mini_stream = bytearray(self.SECTOR_SIZE)

        # Build the binary
        ole = bytearray()

        # Header (512 bytes)
        header = bytearray(512)
        header[0:8] = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        struct.pack_into("<H", header, 24, 0x003E)  # minor ver
        struct.pack_into("<H", header, 26, 0x0003)  # major ver (v3)
        struct.pack_into("<H", header, 28, 0xFFFE)  # little-endian
        struct.pack_into("<H", header, 30, 0x0009)  # sector size 512
        struct.pack_into("<H", header, 32, 0x0006)  # mini sector 64
        struct.pack_into("<I", header, 44, 1)       # FAT sectors
        struct.pack_into("<I", header, 48, 1)       # first dir sector
        struct.pack_into("<I", header, 56, 0x1000)  # mini stream cutoff
        struct.pack_into("<I", header, 60, mini_fat_sector)
        struct.pack_into("<I", header, 64, 1)       # mini FAT sectors
        struct.pack_into("<I", header, 68, self.ENDOFCHAIN)  # no DIFAT
        # DIFAT in header
        struct.pack_into("<I", header, 76, 0)  # FAT at sector 0
        for i in range(1, 109):
            struct.pack_into("<I", header, 76 + i * 4, self.ENDOFCHAIN)
        ole += header

        # Sector 0: FAT
        fat_bytes = bytearray(self.SECTOR_SIZE)
        for i in range(self.SECTOR_SIZE // 4):
            struct.pack_into("<I", fat_bytes, i * 4, fat[i] if i < len(fat) else self.FREESECT)
        ole += fat_bytes

        # Directory sectors
        ole += directory

        # Stream data sectors
        for sector_type, entry_idx in sector_map[dir_sectors + 1:]:
            if sector_type == "stream" and entry_idx is not None:
                data = entries[entry_idx][5]
                pos = 0
                for s in stream_sector_map.get(entry_idx, []):
                    chunk = data[pos:pos + self.SECTOR_SIZE]
                    chunk = chunk + b"\x00" * (self.SECTOR_SIZE - len(chunk))
                    ole += chunk
                    pos += self.SECTOR_SIZE
            elif sector_type == "stream":
                ole += bytearray(self.SECTOR_SIZE)
            elif sector_type == "minifat":
                mf = bytearray(self.SECTOR_SIZE)
                for i in range(self.SECTOR_SIZE // 4):
                    struct.pack_into("<I", mf, i * 4, mini_fat[i] if i < len(mini_fat) else self.FREESECT)
                ole += mf
            elif sector_type == "ministream":
                ole += mini_stream

        return bytes(ole)


def compressed_int(val):
    """MS-OVBA compressed integer encoding."""
    if val <= 0x7FFF:
        return struct.pack("<H", val)
    raise ValueError(f"Value too large: {val}")

def compressed_str(s):
    """MS-OVBA compressed string encoding."""
    b = s.encode("cp1252")
    return compressed_int(len(b)) + b


def build_vba_project_stream():
    """Build the _VBA_PROJECT binary stream per MS-OVBA spec."""
    p = bytearray()
    # PERFORMANCE_CACHE (optional)
    p += struct.pack("<I", 0)
    # PROJECTVERSION (6 bytes)
    p += b"\x00\x00"          # reserved
    p += struct.pack("<H", 0x0032)  # version
    p += b"\x00\x00"          # reserved
    # PROJECTCODEPAGE
    p += compressed_int(1252)
    # PROJECTLCID
    p += compressed_int(3082)  # es-AR
    # PROJECTNAME
    p += compressed_str("VBAProject")
    # PROJECTDOCSTRING (empty)
    p += compressed_int(0)
    # PROJECTHELPFILEPATH (empty)
    p += compressed_int(0)
    # PROJECTHELPCONTEXT
    p += struct.pack("<I", 0)
    # PROJECTLIBFLAGS
    p += struct.pack("<I", 0)
    # PROJECTVERSION2
    p += struct.pack("<H", 0)
    # PROJECTREFERENCES - 3 standard refs
    refs = [
        ("stdole", "{00020430-0000-0000-C000-000000000046}"),
        ("Office", "{2DF8D04C-5BFA-101B-BDE5-00AA0044DE52}"),
        ("Excel", "{00020813-0000-0000-C000-000000000046}"),
    ]
    for ref_name, guid in refs:
        p += b"\x1F\x00"
        ref_data = compressed_str(ref_name)
        ref_data += compressed_str(f"*\\G{guid}")
        ref_data += compressed_int(0)   # LibIdExtended
        ref_data += b"\x00\x00\x00"    # Reserved3
        p += struct.pack("<I", len(ref_data)) + ref_data
    # PROJECTMODULES - Module1
    p += b"\x1F\x00"
    mod_data = compressed_str("Module1")
    mod_data += compressed_str("Module1")  # stream name
    mod_data += compressed_int(0)   # docstring (empty)
    mod_data += struct.pack("<I", 0)  # cookie
    mod_data += b"\x00"   # readonly
    mod_data += b"\x00"   # private
    mod_data += b"\x00\x00\x00\x00"  # reserved
    p += struct.pack("<I", len(mod_data)) + mod_data
    # TERMINATOR
    p += b"\x10\x00"
    return bytes(p)


def build_dir_stream():
    """Build the 'dir' stream with module directory entries."""
    d = bytearray()
    # Entry 0: ThisWorkbook (128 bytes)
    e = bytearray(128)
    nb = "ThisWorkbook".encode("utf-16-le")
    e[0:len(nb)] = nb
    struct.pack_into("<H", e, 64, len(nb) + 2)
    e[66] = 2  # stream
    e[67] = 1  # black
    d += e
    # Entry 1: Module1
    e = bytearray(128)
    nb = "Module1".encode("utf-16-le")
    e[0:len(nb)] = nb
    struct.pack_into("<H", e, 64, len(nb) + 2)
    e[66] = 2  # stream
    e[67] = 1  # black
    d += e
    # Pad to 2-byte boundary
    if len(d) % 2 != 0:
        d += b"\x00"
    return bytes(d)


def vba_compress_raw(data):
    """Create VBA compressed container using raw (uncompressed) chunks."""
    container = bytearray()
    container += struct.pack("<H", 0x01CF)  # Signature
    container += struct.pack("<H", 0x0000)  # Reserved
    # Process in 4096-byte chunks
    chunks = bytearray()
    offset = 0
    while offset < len(data):
        raw_size = min(4096, len(data) - offset)
        chunk = data[offset:offset + raw_size]
        # Raw chunk: sig=0x0000, CompressedChunkSize=raw_size, RawChunkSize=raw_size
        chunks += struct.pack("<HHH", 0x0000, raw_size, raw_size)
        chunks += chunk
        offset += raw_size
    container += struct.pack("<I", len(chunks))
    container += chunks
    return bytes(container)


def get_vba_code():
    """Return the VBA macro source code."""
    return (
        'Attribute VB_Name = "Module1"\r\n'
        '\r\n'
        'Sub GuardarFactura()\r\n'
        '    Dim wsPlantilla As Worksheet\r\n'
        '    Dim wsBD As Worksheet\r\n'
        '    Dim nuevaHoja As Worksheet\r\n'
        '    Dim numFactura As String\r\n'
        '    Dim tipoFac As String\r\n'
        '    Dim fechaFac As String\r\n'
        '    Dim razonSocial As String\r\n'
        '    Dim cuit As String\r\n'
        '    Dim filaItem As Long\r\n'
        '    Dim ultimaFilaBD As Long\r\n'
        '    Dim totalFactura As Double\r\n'
        '    Dim contadorItems As Long\r\n'
        '    Dim subtotal As Double\r\n'
        '    Dim i As Long\r\n'
        '    \r\n'
        '    Set wsPlantilla = ThisWorkbook.Sheets("Plantilla")\r\n'
        '    Set wsBD = ThisWorkbook.Sheets("BaseDeDatos")\r\n'
        '    \r\n'
        '    numFactura = Trim(CStr(wsPlantilla.Range("C4").Value))\r\n'
        '    If numFactura = "" Then\r\n'
        '        MsgBox "Ingrese el numero de factura antes de guardar.", vbExclamation, "Dato faltante"\r\n'
        '        wsPlantilla.Range("C4").Select\r\n'
        '        Exit Sub\r\n'
        '    End If\r\n'
        '    \r\n'
        '    tipoFac = Trim(CStr(wsPlantilla.Range("G4").Value))\r\n'
        '    If tipoFac = "" Then tipoFac = "FC"\r\n'
        '    \r\n'
        '    fechaFac = Trim(CStr(wsPlantilla.Range("C5").Value))\r\n'
        '    If fechaFac = "" Then\r\n'
        '        fechaFac = Format(Date, "dd/mm/yyyy")\r\n'
        '    ElseIf IsDate(fechaFac) Then\r\n'
        '        fechaFac = Format(CDate(fechaFac), "dd/mm/yyyy")\r\n'
        '    End If\r\n'
        '    \r\n'
        '    razonSocial = Trim(CStr(wsPlantilla.Range("C6").Value))\r\n'
        '    cuit = Trim(CStr(wsPlantilla.Range("C7").Value))\r\n'
        '    \r\n'
        '    ultimaFilaBD = wsBD.Cells(wsBD.Rows.Count, 1).End(xlUp).Row + 1\r\n'
        '    If ultimaFilaBD < 5 Then ultimaFilaBD = 5\r\n'
        '    \r\n'
        '    filaItem = 11\r\n'
        '    totalFactura = 0\r\n'
        '    contadorItems = 0\r\n'
        '    \r\n'
        '    Application.ScreenUpdating = False\r\n'
        '    \r\n'
        '    Do While filaItem <= 40\r\n'
        '        Dim codProd As String\r\n'
        '        Dim descProd As String\r\n'
        '        Dim cantProd As Variant\r\n'
        '        Dim puProd As Variant\r\n'
        '        \r\n'
        '        cantProd = wsPlantilla.Cells(filaItem, 5).Value\r\n'
        '        codProd = Trim(CStr(wsPlantilla.Cells(filaItem, 2).Value))\r\n'
        '        descProd = Trim(CStr(wsPlantilla.Cells(filaItem, 4).Value))\r\n'
        '        puProd = wsPlantilla.Cells(filaItem, 7).Value\r\n'
        '        \r\n'
        '        If descProd <> "" And IsNumeric(cantProd) And CDbl(cantProd) > 0 Then\r\n'
        '            subtotal = 0\r\n'
        '            If IsNumeric(puProd) Then\r\n'
        '                subtotal = CDbl(cantProd) * CDbl(puProd)\r\n'
        '            End If\r\n'
        '            \r\n'
        '            wsBD.Cells(ultimaFilaBD, 1).Value = numFactura\r\n'
        '            wsBD.Cells(ultimaFilaBD, 2).Value = tipoFac\r\n'
        '            wsBD.Cells(ultimaFilaBD, 3).Value = fechaFac\r\n'
        '            wsBD.Cells(ultimaFilaBD, 4).Value = codProd\r\n'
        '            wsBD.Cells(ultimaFilaBD, 5).Value = descProd\r\n'
        '            wsBD.Cells(ultimaFilaBD, 6).Value = CDbl(cantProd)\r\n'
        '            wsBD.Cells(ultimaFilaBD, 7).Value = puProd\r\n'
        '            wsBD.Cells(ultimaFilaBD, 8).Value = subtotal\r\n'
        '            wsBD.Cells(ultimaFilaBD, 9).Value = 0\r\n'
        '            \r\n'
        '            totalFactura = totalFactura + subtotal\r\n'
        '            contadorItems = contadorItems + 1\r\n'
        '            ultimaFilaBD = ultimaFilaBD + 1\r\n'
        '        End If\r\n'
        '        \r\n'
        '        filaItem = filaItem + 1\r\n'
        '    Loop\r\n'
        '    \r\n'
        '    If contadorItems = 0 Then\r\n'
        '        MsgBox "No se encontraron productos para guardar. Ingrese al menos un item.", vbExclamation, "Sin productos"\r\n'
        '        Application.ScreenUpdating = True\r\n'
        '        Exit Sub\r\n'
        '    End If\r\n'
        '    \r\n'
        '    Dim firstRow As Long\r\n'
        '    firstRow = ultimaFilaBD - contadorItems\r\n'
        '    For i = firstRow To ultimaFilaBD - 1\r\n'
        '        wsBD.Cells(i, 9).Value = totalFactura\r\n'
        '        wsBD.Cells(i, 9).NumberFormat = "#,##0.00"\r\n'
        '        wsBD.Cells(i, 6).NumberFormat = "#,##0"\r\n'
        '        wsBD.Cells(i, 7).NumberFormat = "#,##0.00"\r\n'
        '        wsBD.Cells(i, 8).NumberFormat = "#,##0.00"\r\n'
        '    Next i\r\n'
        '    \r\n'
        '    wsPlantilla.Copy After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count)\r\n'
        '    Set nuevaHoja = ActiveSheet\r\n'
        '    \r\n'
        '    Dim nombreHoja As String\r\n'
        '    nombreHoja = Replace(Replace(numFactura, "/", "-"), " ", "")\r\n'
        '    nombreHoja = Left(nombreHoja, 31)\r\n'
        '    \r\n'
        '    Dim intento As Long\r\n'
        '    Dim nombreBase As String\r\n'
        '    nombreBase = nombreHoja\r\n'
        '    intento = 1\r\n'
        '    On Error Resume Next\r\n'
        '    Do\r\n'
        '        nuevaHoja.Name = nombreHoja\r\n'
        '        If Err.Number <> 0 Then\r\n'
        '            Err.Clear\r\n'
        '            intento = intento + 1\r\n'
        '            nombreHoja = Left(nombreBase, 28) & "(" & intento & ")"\r\n'
        '        Else\r\n'
        '            Exit Do\r\n'
        '        End If\r\n'
        '    Loop While intento < 100\r\n'
        '    On Error GoTo 0\r\n'
        '    \r\n'
        '    Dim celda As Range\r\n'
        '    For Each celda In wsPlantilla.Range("C4:C8")\r\n'
        '        celda.ClearContents\r\n'
        '    Next celda\r\n'
        '    wsPlantilla.Range("G4").ClearContents\r\n'
        '    wsPlantilla.Range("G7").ClearContents\r\n'
        '    \r\n'
        '    For i = 11 To 40\r\n'
        '        wsPlantilla.Cells(i, 2).ClearContents\r\n'
        '        wsPlantilla.Cells(i, 4).ClearContents\r\n'
        '        wsPlantilla.Cells(i, 5).ClearContents\r\n'
        '        wsPlantilla.Cells(i, 7).ClearContents\r\n'
        '    Next i\r\n'
        '    \r\n'
        '    wsPlantilla.Range("C4").Select\r\n'
        '    Application.ScreenUpdating = True\r\n'
        '    \r\n'
        '    MsgBox "Factura " & numFactura & " guardada correctamente." & vbCrLf & vbCrLf & _\r\n'
        '           "Items: " & contadorItems & "  |  Total: $" & Format(totalFactura, "#,##0.00"), _\r\n'
        '           vbInformation, "Factura Guardada"\r\n'
        'End Sub\r\n'
        '\r\n'
        'Sub BuscarFactura()\r\n'
        '    Dim wsBD As Worksheet\r\n'
        '    Dim termino As String\r\n'
        '    Dim ultimaFila As Long\r\n'
        '    Dim i As Long\r\n'
        '    Dim resultados As String\r\n'
        '    Dim contador As Long\r\n'
        '    \r\n'
        '    Set wsBD = ThisWorkbook.Sheets("BaseDeDatos")\r\n'
        '    \r\n'
        '    termino = LCase(Trim(InputBox("Ingrese numero de factura, codigo o descripcion a buscar:", "Buscar Factura", "")))\r\n'
        '    \r\n'
        '    If termino = "" Then Exit Sub\r\n'
        '    \r\n'
        '    ultimaFila = wsBD.Cells(wsBD.Rows.Count, 1).End(xlUp).Row\r\n'
        '    resultados = ""\r\n'
        '    contador = 0\r\n'
        '    \r\n'
        '    For i = 4 To ultimaFila\r\n'
        '        Dim col1 As String\r\n'
        '        Dim col4 As String\r\n'
        '        Dim col5 As String\r\n'
        '        col1 = LCase(CStr(wsBD.Cells(i, 1).Value))\r\n'
        '        col4 = LCase(CStr(wsBD.Cells(i, 4).Value))\r\n'
        '        col5 = LCase(CStr(wsBD.Cells(i, 5).Value))\r\n'
        '        \r\n'
        '        If InStr(col1, termino) > 0 Or InStr(col4, termino) > 0 Or InStr(col5, termino) > 0 Then\r\n'
        '            resultados = resultados & "Fila " & i & ": " & _\r\n'
        '                wsBD.Cells(i, 1).Value & " | " & _\r\n'
        '                wsBD.Cells(i, 5).Value & " | $" & _\r\n'
                '                Format(wsBD.Cells(i, 8).Value, "#,##0.00") & vbCrLf\r\n'
        '            contador = contador + 1\r\n'
        '            If contador >= 30 Then\r\n'
        '                resultados = resultados & "... (mas de 30 resultados)" & vbCrLf\r\n'
        '                Exit For\r\n'
        '            End If\r\n'
        '        End If\r\n'
        '    Next i\r\n'
        '    \r\n'
        '    If resultados = "" Then\r\n'
        '        MsgBox "No se encontraron resultados para: " & termino, vbInformation, "Sin resultados"\r\n'
        '    Else\r\n'
        '        MsgBox "Se encontraron " & contador & " resultado(s):" & vbCrLf & vbCrLf & resultados, vbInformation, "Resultados de busqueda"\r\n'
        '    End If\r\n'
        'End Sub\r\n'
    )


def create_vba_project_bin():
    """Create a complete vbaProject.bin OLE Compound Document."""
    ole = OleCompoundDoc()
    ole.add_storage("\x01VBA")
    ole.add_stream(("_VBA_PROJECT",), build_vba_project_stream())
    ole.add_stream(("dir",), build_dir_stream())
    vba_code = get_vba_code().encode("cp1252")
    ole.add_stream(("Module1",), vba_compress_raw(vba_code))
    return ole.build()


# ============================================================
# 3. COMBINE: Create .xlsm from .xlsx + VBA
# ============================================================
def create_xlsm(xlsx_path, xlsm_path, vba_bin_path):
    """Inject vbaProject.bin and VBA rels into an xlsx to create xlsm."""
    # Read the xlsx (it's a zip)
    with zipfile.ZipFile(xlsx_path, "r") as zin:
        files = {name: zin.read(name) for name in zin.namelist()}

    # 1. Add vbaProject.bin
    with open(vba_bin_path, "rb") as f:
        vba_bin = f.read()
    files["xl/vbaProject.bin"] = vba_bin

    # 2. Update [Content_Types].xml to include VBA content type
    ct = files["[Content_Types].xml"].decode("utf-8")
    if 'Extension="bin"' not in ct:
        ct = ct.replace(
            '</Types>',
            '  <Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>\n</Types>'
        )
    files["[Content_Types].xml"] = ct.encode("utf-8")

    # 3. Update xl/workbook.xml to include vbaProject reference
    wb_xml = files["xl/workbook.xml"].decode("utf-8")
    if 'r:id="rIdVBA"' not in wb_xml:
        # Add the VBA relationship reference
        # We need to find the highest rId number
        import re
        rids = re.findall(r'rId\d+', wb_xml)
        max_rid = max([int(r.replace("rId", "")) for r in rids]) if rids else 0
        new_rid = f"rId{max_rid + 1}"
        # Insert before closing tag
        wb_xml = wb_xml.replace(
            "</workbook>",
            f'<legacyDrawing r:id="{new_rid}"/></workbook>'
        )
    files["xl/workbook.xml"] = wb_xml.encode("utf-8")

    # 4. Update xl/workbook.xml.rels to include VBA relationship
    rels_path = "xl/_rels/workbook.xml.rels"
    if rels_path in files:
        rels = files[rels_path].decode("utf-8")
        if "vbaProject" not in rels:
            import re
            rids = re.findall(r'Id="rId(\d+)"', rels)
            max_rid = max([int(r) for r in rids]) if rids else 0
            new_rid = f"rId{max_rid + 1}"
            new_rel = (
                f'<Relationship Id="{new_rid}" '
                f'Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" '
                f'Target="vbaProject.bin"/>'
            )
            # Replace the rId in workbook.xml to match
            wb_xml = files["xl/workbook.xml"].decode("utf-8")
            wb_xml = wb_xml.replace(f'r:id="rId{max_rid + 1}"', f'r:id="{new_rid}"')
            files["xl/workbook.xml"] = wb_xml.encode("utf-8")
            rels = rels.replace("</Relationships>", new_rel + "</Relationships>")
        files[rels_path] = rels.encode("utf-8")

    # Write the xlsm
    with zipfile.ZipFile(xlsm_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)


# ============================================================
# MAIN
# ============================================================
def main():
    os.makedirs("/home/z/my-project/download", exist_ok=True)

    print("1. Creando libro Excel con openpyxl...")
    wb = create_workbook()

    xlsx_temp = "/tmp/cucimundo_temp.xlsx"
    wb.save(xlsx_temp)
    print(f"   Guardado temporal: {xlsx_temp}")

    print("2. Generando vbaProject.bin...")
    vba_bin = create_vba_project_bin()
    vba_path = "/tmp/vbaProject.bin"
    with open(vba_path, "wb") as f:
        f.write(vba_bin)
    print(f"   vbaProject.bin: {len(vba_bin)} bytes")

    # Verify OLE
    import olefile
    ole = olefile.OleFileIO(vba_path)
    print(f"   Estructura OLE valida: {ole.listdir()}")
    ole.close()

    print("3. Inyectando VBA para crear .xlsm...")
    xlsm_path = "/home/z/my-project/download/CUCIMUNDO_Facturas.xlsm"
    create_xlsm(xlsx_temp, xlsm_path, vba_path)
    print(f"   Creado: {xlsm_path}")

    # Cleanup
    os.remove(xlsx_temp)
    os.remove(vba_path)

    print("4. Verificando archivo final...")
    with zipfile.ZipFile(xlsm_path, "r") as z:
        names = z.namelist()
        has_vba = "xl/vbaProject.bin" in names
        print(f"   Archivos: {len(names)} componentes")
        print(f"   vbaProject.bin: {'SI' if has_vba else 'NO'}")
        for n in sorted(names):
            info = z.getinfo(n)
            print(f"     {n} ({info.file_size} bytes)")

    print(f"\nLISTO: {xlsm_path}")
    print("Abrilo en Excel y habilita las macros para usar los botones.")


if __name__ == "__main__":
    main()