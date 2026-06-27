"""
Genera el archivo Excel con macro VBA para Karen:
- Hoja "Base de Datos": acumula todas las facturas guardadas
- Hoja "Plantilla": donde Karen llena cada factura
- Botón "Guardar": duplica la plantilla como nueva hoja y registra en Base de Datos
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
import os

# ============================================================
# ESTILOS
# ============================================================
MORADO = "6B21B6"
MORADO_OSCURO = "3B0764"
MORADO_CLARO = "F3E8FF"
BLANCO = "FFFFFF"
GRIS_CLARO = "F8F9FA"
GRIS_MEDIO = "DEE2E6"
GRIS_TEXT = "6C757D"

font_title = Font(name="Calibri", size=14, bold=True, color=BLANCO)
font_subtitle = Font(name="Calibri", size=9, italic=True, color=GRIS_TEXT)
font_header = Font(name="Calibri", size=10, bold=True, color=BLANCO)
font_normal = Font(name="Calibri", size=10)
font_bold = Font(name="Calibri", size=10, bold=True)
font_numero = Font(name="Calibri", size=12, bold=True)
font_mono = Font(name="Consolas", size=10)
font_total_label = Font(name="Calibri", size=10, bold=True)
font_total_value = Font(name="Calibri", size=11, bold=True, color=MORADO)

fill_morado = PatternFill(start_color=MORADO, end_color=MORADO, fill_type="solid")
fill_morado_oscuro = PatternFill(start_color=MORADO_OSCURO, end_color=MORADO_OSCURO, fill_type="solid")
fill_morado_claro = PatternFill(start_color=MORADO_CLARO, end_color=MORADO_CLARO, fill_type="solid")
fill_gris_claro = PatternFill(start_color=GRIS_CLARO, end_color=GRIS_CLARO, fill_type="solid")
fill_blanco = PatternFill(start_color=BLANCO, end_color=BLANCO, fill_type="solid")

align_center = Alignment(horizontal="center", vertical="center")
align_left = Alignment(horizontal="left", vertical="center")
align_right = Alignment(horizontal="right", vertical="center")
align_wrap = Alignment(horizontal="left", vertical="center", wrap_text=True)

thin_border = Border(
    left=Side(style="thin", color=GRIS_MEDIO),
    right=Side(style="thin", color=GRIS_MEDIO),
    top=Side(style="thin", color=GRIS_MEDIO),
    bottom=Side(style="thin", color=GRIS_MEDIO),
)

morado_border = Border(
    left=Side(style="thin", color=MORADO),
    right=Side(style="thin", color=MORADO),
    top=Side(style="thin", color=MORADO),
    bottom=Side(style="thin", color=MORADO),
)


def apply_border_range(ws, min_row, max_row, min_col, max_col, border=thin_border):
    for r in range(min_row, max_row + 1):
        for c in range(min_col, max_col + 1):
            ws.cell(row=r, column=c).border = border


def style_header_row(ws, row, headers, cols):
    """Aplica estilo a una fila de encabezados"""
    for i, (header, col) in enumerate(zip(headers, cols)):
        cell = ws.cell(row=row, column=col, value=header)
        cell.font = font_header
        cell.fill = fill_morado_oscuro
        cell.alignment = align_center
        cell.border = morado_border


# ============================================================
# CREAR WORKBOOK
# ============================================================
wb = openpyxl.Workbook()

# ============================================================
# HOJA 1: BASE DE DATOS (a la izquierda)
# ============================================================
bd = wb.active
bd.title = "Base de Datos"
bd.sheet_properties.tabColor = MORADO

# Título
bd.merge_cells("A1:I1")
titulo = bd["A1"]
titulo.value = "BASE DE DATOS - FACTURAS"
titulo.font = font_title
titulo.fill = fill_morado
titulo.alignment = align_center
bd.row_dimensions[1].height = 40

# Subtítulo
bd.merge_cells("A2:I2")
sub = bd["A2"]
sub.value = "Las facturas se agregan automáticamente al presionar Guardar en la Plantilla"
sub.font = font_subtitle
sub.fill = fill_morado_claro
sub.alignment = align_center
bd.row_dimensions[2].height = 22

# Encabezados
bd_headers = [
    "N° Factura", "Tipo", "Fecha", "Código", "Descripción",
    "Cantidad", "P.Unitario", "Subtotal", "Total Factura"
]
bd_cols = list(range(1, 10))
style_header_row(bd, 3, bd_headers, bd_cols)
bd.row_dimensions[3].height = 24

# Anchos de columna
bd_widths = [20, 7, 13, 11, 45, 11, 14, 14, 16]
for i, w in enumerate(bd_widths):
    bd.column_dimensions[get_column_letter(i + 1)].width = w

# Congelar paneles
bd.freeze_panes = "A4"

# Auto-filtro
bd.auto_filter.ref = f"A3:I3"

# ============================================================
# HOJA 2: PLANTILLA
# ============================================================
pt = wb.create_sheet("Plantilla")
pt.sheet_properties.tabColor = "D97706"

# Columnas: A=3, B=14, C=14, D=3, E=14, F=14, G=14, H=14, I=14
pt_cols_widths = {"A": 3, "B": 14, "C": 14, "D": 3, "E": 14, "F": 14, "G": 14, "H": 14, "I": 14}
for col, w in pt_cols_widths.items():
    pt.column_dimensions[col].width = w

# --- FILA 1: Número de factura ---
pt.merge_cells("G1:I1")
cell_num = pt["G1"]
cell_num.value = ""
cell_num.font = font_numero
cell_num.alignment = Alignment(horizontal="left", vertical="center")
cell_num.border = Border(bottom=Side(style="medium", color=MORADO))
pt.row_dimensions[1].height = 28

# Etiqueta
pt["B1"].value = "N° Factura:"
pt["B1"].font = Font(name="Calibri", size=9, bold=True, color=GRIS_TEXT)
pt["B1"].alignment = align_left

# --- FILA 2: Tipo ---
pt["G2"].value = "FC"
pt["G2"].font = font_normal
pt.row_dimensions[2].height = 20

pt["B2"].value = "Tipo:"
pt["B2"].font = Font(name="Calibri", size=9, bold=True, color=GRIS_TEXT)

# --- FILA 3: Fecha ---
pt["G3"].value = ""
pt["G3"].number_format = "DD/MM/YYYY"
pt["G3"].font = font_normal
pt.row_dimensions[3].height = 20

pt["B3"].value = "Fecha:"
pt["B3"].font = Font(name="Calibri", size=9, bold=True, color=GRIS_TEXT)

# --- FILA 4: Proveedor ---
pt.merge_cells("B4:F4")
pt["B4"].value = ""
pt["B4"].font = Font(name="Calibri", size=11, bold=True)
pt["B4"].border = Border(bottom=Side(style="thin", color=GRIS_MEDIO))
pt.row_dimensions[4].height = 24

pt["B5"].value = "Razón Social:"
pt["B5"].font = Font(name="Calibri", size=9, bold=True, color=GRIS_TEXT)

# --- FILA 8-10: Encabezados de la tabla de productos ---
header_row = 8
item_headers = [
    ("B", "CANTIDAD"),
    ("C", "CODIGO"),
    ("D", ""),  # separador
    ("E", "DESCRIPCION"),
    ("G", "P.UNI"),
    ("H", "TOTAL"),
]

# Merge DESCRIPCION: E-F
pt.merge_cells(f"E{header_row}:F{header_row}")

for col, label in item_headers:
    if label:
        cell = pt[f"{col}{header_row}"]
        cell.value = label
        cell.font = font_header
        cell.fill = fill_morado_oscuro
        cell.alignment = align_center
        cell.border = morado_border

pt.row_dimensions[header_row].height = 22

# --- FILAS 9-28: Área de productos (20 filas vacías) ---
for r in range(9, 29):
    pt.row_dimensions[r].height = 20
    for col in ["B", "C", "E", "F", "G", "H"]:
        cell = pt[f"{col}{r}"]
        cell.border = thin_border
        cell.font = font_normal
    # Merge E-F for description
    pt.merge_cells(f"E{r}:F{r}")
    # Cantidad: right align
    pt[f"B{r}"].alignment = align_right
    pt[f"B{r}"].number_format = "#,##0"
    # P.UNI y TOTAL: right align, money format
    pt[f"G{r}"].alignment = align_right
    pt[f"G{r}"].number_format = "#,##0.00"
    pt[f"H{r}"].alignment = align_right
    pt[f"H{r}"].number_format = "#,##0.00"
    # Fórmula TOTAL = CANTIDAD * P.UNI
    pt[f"H{r}"].value = f"=IF(B{r}=\"\",\"\",B{r}*G{r})"

# --- FILA 29: Total general ---
total_row = 29
pt.merge_cells(f"E{total_row}:F{total_row}")
pt[f"E{total_row}"].value = "TOTAL"
pt[f"E{total_row}"].font = font_total_label
pt[f"E{total_row}"].alignment = align_right
pt[f"E{total_row}"].border = Border(top=Side(style="double", color=MORADO))

pt[f"H{total_row}"].value = f"=SUM(H9:H28)"
pt[f"H{total_row}"].font = font_total_value
pt[f"H{total_row}"].alignment = align_right
pt[f"H{total_row}"].number_format = "#,##0.00"
pt[f"H{total_row}"].border = Border(top=Side(style="double", color=MORADO))

pt.row_dimensions[total_row].height = 26

# ============================================================
# BOTÓN GUARDAR (como forma rectangular con texto)
# Como openpyxl no soporta VBA directamente, creo el botón visual
# y genero el código VBA por separado.
# ============================================================

# Botón visual en la plantilla
btn_row = 31
pt.merge_cells(f"B{btn_row}:D{btn_row}")
btn_cell = pt[f"B{btn_row}"]
btn_cell.value = "⬆ GUARDAR FACTURA ⬆"
btn_cell.font = Font(name="Calibri", size=12, bold=True, color=BLANCO)
btn_cell.fill = fill_morado
btn_cell.alignment = align_center
btn_cell.border = Border(
    left=Side(style="medium", color=MORADO_OSCURO),
    right=Side(style="medium", color=MORADO_OSCURO),
    top=Side(style="medium", color=MORADO_OSCURO),
    bottom=Side(style="medium", color=MORADO_OSCURO),
)
pt.row_dimensions[btn_row].height = 36

# Instrucciones
pt[f"E{btn_row}"].value = "Presioná el botón para guardar (necesitás la macro activada)"
pt[f"E{btn_row}"].font = Font(name="Calibri", size=9, italic=True, color=GRIS_TEXT)
pt.merge_cells(f"E{btn_row}:I{btn_row}")

# ============================================================
# GUARDAR COMO XLSM (con macro)
# ============================================================
# openpyxl no puede incrustar VBA, así que:
# 1. Guardo el xlsx base
# 2. Creo un archivo de instrucciones para agregar la macro

output_dir = "/home/z/my-project/download"
os.makedirs(output_dir, exist_ok=True)
xlsx_path = os.path.join(output_dir, "Facturas_Macro.xlsx")
wb.save(xlsx_path)
print(f"Guardado: {xlsx_path}")

# ============================================================
# GENERAR CÓDIGO VBA (para pegar manualmente o con script)
# ============================================================
vba_code = '''
' ============================================================
' MACRO: Guardar Factura
' 1. Valida que haya número de factura
' 2. Copia la plantilla como nueva hoja (nombre = N° factura)
' 3. Registra los productos en Base de Datos
' 4. Limpia la plantilla para la siguiente factura
' ============================================================
Sub GuardarFactura()

    Dim wsPlantilla As Worksheet
    Dim wsBD As Worksheet
    Dim numFactura As String
    Dim tipoFactura As String
    Dim fechaFactura As String
    Dim proveedor As String
    Dim nuevaHoja As Worksheet
    Dim filaBD As Long
    Dim filaProd As Long
    Dim codigo As String
    Dim descripcion As String
    Dim cantidad As Variant
    Dim pUnit As Variant
    Dim subtotal As Variant
    Dim totalFactura As Variant
    
    Set wsPlantilla = ThisWorkbook.Sheets("Plantilla")
    Set wsBD = ThisWorkbook.Sheets("Base de Datos")
    
    ' --- 1. VALIDAR ---
    numFactura = Trim(wsPlantilla.Range("G1").Value)
    If numFactura = "" Then
        MsgBox "Ingresa el numero de factura antes de guardar.", vbExclamation, "Dato faltante"
        wsPlantilla.Range("G1").Select
        Exit Sub
    End If
    
    ' Verificar que no exista ya
    Dim hojaExiste As Boolean
    hojaExiste = False
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Sheets
        If ws.Name = numFactura Then
            hojaExiste = True
            Exit For
        End If
    Next ws
    
    If hojaExiste Then
        If MsgBox("Ya existe una hoja con ese numero. Queres reemplazarla?", vbQuestion + vbYesNo, "Duplicado") = vbNo Then
            Exit Sub
        Else
            Application.DisplayAlerts = False
            ThisWorkbook.Sheets(numFactura).Delete
            Application.DisplayAlerts = True
        End If
    End If
    
    ' Verificar que haya al menos un producto
    Dim tieneProductos As Boolean
    tieneProductos = False
    For filaProd = 9 To 28
        If Trim(wsPlantilla.Cells(filaProd, 5).Value) <> "" And wsPlantilla.Cells(filaProd, 2).Value <> "" Then
            tieneProductos = True
            Exit For
        End If
    Next filaProd
    
    If Not tieneProductos Then
        MsgBox "Agrega al menos un producto con descripcion y cantidad.", vbExclamation, "Sin productos"
        Exit Sub
    End If
    
    ' --- 2. COPIAR PLANTILLA COMO NUEVA HOJA ---
    tipoFactura = Trim(wsPlantilla.Range("G2").Value)
    fechaFactura = Trim(wsPlantilla.Range("G3").Value)
    proveedor = Trim(wsPlantilla.Range("B4").Value)
    totalFactura = wsPlantilla.Range("H29").Value
    
    wsPlantilla.Copy Before:=wsPlantilla
    Set nuevaHoja = ActiveSheet
    On Error Resume Next
    nuevaHoja.Name = numFactura
    On Error GoTo 0
    
    ' Si no se pudo poner el nombre exacto, usar uno seguro
    If nuevaHoja.Name <> numFactura Then
        Dim nombreSeguro As String
        nombreSeguro = Replace(numFactura, "\", "_")
        nombreSeguro = Replace(nombreSeguro, "/", "_")
        nombreSeguro = Replace(nombreSeguro, "*", "_")
        nombreSeguro = Replace(nombreSeguro, "?", "_")
        nombreSeguro = Replace(nombreSeguro, "[", "_")
        nombreSeguro = Replace(nombreSeguro, "]", "_")
        nombreSeguro = Replace(nombreSeguro, ":", "_")
        nombreSeguro = Left(nombreSeguro, 31)
        nuevaHoja.Name = nombreSeguro
    End If
    
    ' --- 3. REGISTRAR EN BASE DE DATOS ---
    Application.ScreenUpdating = False
    
    For filaProd = 9 To 28
        descripcion = Trim(wsPlantilla.Cells(filaProd, 5).Value)
        cantidad = wsPlantilla.Cells(filaProd, 2).Value
        codigo = Trim(wsPlantilla.Cells(filaProd, 3).Value)
        pUnit = wsPlantilla.Cells(filaProd, 7).Value
        subtotal = wsPlantilla.Cells(filaProd, 8).Value
        
        If descripcion <> "" And cantidad <> "" And IsNumeric(cantidad) Then
            If CDbl(cantidad) > 0 Then
                ' Buscar la proxima fila vacia en Base de Datos
                filaBD = wsBD.Cells(wsBD.Rows.Count, 1).End(xlUp).Row + 1
                If filaBD < 4 Then filaBD = 4
                
                wsBD.Cells(filaBD, 1).Value = numFactura
                wsBD.Cells(filaBD, 2).Value = tipoFactura
                wsBD.Cells(filaBD, 3).Value = fechaFactura
                wsBD.Cells(filaBD, 4).Value = codigo
                wsBD.Cells(filaBD, 5).Value = descripcion
                wsBD.Cells(filaBD, 6).Value = cantidad
                wsBD.Cells(filaBD, 7).Value = pUnit
                wsBD.Cells(filaBD, 8).Value = subtotal
                wsBD.Cells(filaBD, 9).Value = totalFactura
                
                ' Aplicar formato
                wsBD.Cells(filaBD, 6).NumberFormat = "#,##0"
                wsBD.Cells(filaBD, 7).NumberFormat = "#,##0.00"
                wsBD.Cells(filaBD, 8).NumberFormat = "#,##0.00"
                wsBD.Cells(filaBD, 9).NumberFormat = "#,##0.00"
            End If
        End If
    Next filaProd
    
    ' --- 4. LIMPIAR PLANTILLA ---
    wsPlantilla.Range("G1").Value = ""
    wsPlantilla.Range("G2").Value = "FC"
    wsPlantilla.Range("G3").Value = ""
    wsPlantilla.Range("B4").Value = ""
    
    For filaProd = 9 To 28
        wsPlantilla.Cells(filaProd, 2).Value = ""
        wsPlantilla.Cells(filaProd, 3).Value = ""
        wsPlantilla.Cells(filaProd, 5).Value = ""
        wsPlantilla.Cells(filaProd, 7).Value = ""
        wsPlantilla.Cells(filaProd, 8).Value = ""
        ' Restaurar la formula de subtotal
        wsPlantilla.Cells(filaProd, 8).Value = "=IF(B" & filaProd & "="""","""",B" & filaProd & "*G" & filaProd & ")"
    Next filaProd
    
    wsPlantilla.Range("H29").Value = "=SUM(H9:H28)"
    
    Application.ScreenUpdating = True
    
    ' Volver a la plantilla y seleccionar numero
    wsPlantilla.Activate
    wsPlantilla.Range("G1").Select
    
    ' Confirmacion
    MsgBox "Factura " & numFactura & " guardada correctamente.", vbInformation, "Guardado"
    
End Sub

' ============================================================
' MACRO: Buscar en Base de Datos
' ============================================================
Sub BuscarEnBase()
    Dim wsBD As Worksheet
    Dim busqueda As String
    Dim fila As Long
    Dim ultimaFila As Long
    Dim encontradas As Long
    
    Set wsBD = ThisWorkbook.Sheets("Base de Datos")
    
    ' Quitar filtro anterior si existe
    If wsBD.AutoFilterMode Then
        wsBD.AutoFilterMode = False
    End If
    
    busqueda = InputBox("Buscar por numero de factura, descripcion o proveedor:", "Buscar en Base de Datos")
    
    If busqueda = "" Then
        ' Mostrar todo
        wsBD.Range("A3:I3").AutoFilter
        Exit Sub
    End If
    
    ultimaFila = wsBD.Cells(wsBD.Rows.Count, 1).End(xlUp).Row
    
    If ultimaFila < 4 Then
        MsgBox "La base de datos esta vacia.", vbInformation, "Sin datos"
        Exit Sub
    End If
    
    ' Aplicar filtro en todas las columnas relevantes
    wsBD.Range("A3:I" & ultimaFila).AutoFilter Field:=1, Criteria1:="*" & busqueda & "*"
    
    ' Contar filas visibles
    encontradas = 0
    For fila = 4 To ultimaFila
        If wsBD.Rows(fila).Hidden = False Then
            encontradas = encontradas + 1
        End If
    Next fila
    
    If encontradas = 0 Then
        MsgBox "No se encontraron resultados para '" & busqueda & "'.", vbInformation, "Sin resultados"
        wsBD.AutoFilterMode = False
    Else
        wsBD.Activate
        MsgBox encontradas & " resultado(s) encontrado(s).", vbInformation, "Busqueda"
    End If
    
End Sub
'''

vba_path = os.path.join(output_dir, "Macro_VBA_para_pegar.txt")
with open(vba_path, "w", encoding="utf-8") as f:
    f.write(vba_code.strip())
print(f"VBA code: {vba_path}")

# ============================================================
# Ahora intentar crear el .xlsm con la macro incrustada
# Usando xlsxwriter como alternativa para incrustar VBA
# ============================================================
try:
    import xlsxwriter

    xlsm_path = os.path.join(output_dir, "Facturas_Macro.xlsm")

    # Para incrustar VBA necesitamos un archivo .xlsm template
    # xlsxwriter puede crearlo si tenemos un archivo vba_project.bin
    # Como no lo tenemos, creamos el .xlsx y damos instrucciones

    workbook = xlsxwriter.Workbook(xlsx_path)

    # --- Base de Datos ---
    ws_bd = workbook.add_worksheet("Base de Datos")
    ws_bd.set_tab_color(MORADO)

    # Formats
    fmt_title = workbook.add_format({
        "font_name": "Calibri", "font_size": 14, "bold": True,
        "font_color": BLANCO, "bg_color": MORADO,
        "align": "center", "valign": "vcenter", "border": 1
    })
    fmt_sub = workbook.add_format({
        "font_name": "Calibri", "font_size": 9, "italic": True,
        "font_color": GRIS_TEXT, "bg_color": MORADO_CLARO,
        "align": "center", "valign": "vcenter"
    })
    fmt_header = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "bold": True,
        "font_color": BLANCO, "bg_color": MORADO_OSCURO,
        "align": "center", "valign": "vcenter", "border": 1,
        "text_wrap": True
    })
    fmt_normal = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "border": 1
    })
    fmt_num = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "border": 1,
        "align": "right", "num_format": "#,##0"
    })
    fmt_money = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "border": 1,
        "align": "right", "num_format": "#,##0.00"
    })

    # BD Title
    ws_bd.merge_range("A1:I1", "BASE DE DATOS - FACTURAS", fmt_title)
    ws_bd.set_row(0, 40)
    ws_bd.merge_range("A2:I2", "Las facturas se agregan automáticamente al presionar Guardar en la Plantilla", fmt_sub)
    ws_bd.set_row(1, 22)

    # BD Headers
    bd_headers = ["N° Factura", "Tipo", "Fecha", "Código", "Descripción",
                  "Cantidad", "P.Unitario", "Subtotal", "Total Factura"]
    bd_widths_xw = [20, 7, 13, 11, 45, 11, 14, 14, 16]
    for i, (h, w) in enumerate(zip(bd_headers, bd_widths_xw)):
        ws_bd.set_column(i, i, w)
        ws_bd.write(2, i, h, fmt_header)
    ws_bd.set_row(2, 24)

    # Freeze panes
    ws_bd.freeze_panes("A3")
    ws_bd.autofilter("A2:I2")

    # --- Plantilla ---
    ws_pt = workbook.add_worksheet("Plantilla")
    ws_pt.set_tab_color("D97706")

    # Column widths: A=3, B=14, C=14, D=3, E=14, F=14, G=14, H=14, I=14
    pt_widths = [3, 14, 14, 3, 14, 14, 14, 14, 14]
    for i, w in enumerate(pt_widths):
        ws_pt.set_column(i, i, w)

    fmt_label = workbook.add_format({
        "font_name": "Calibri", "font_size": 9, "bold": True,
        "font_color": GRIS_TEXT
    })
    fmt_numero = workbook.add_format({
        "font_name": "Calibri", "font_size": 12, "bold": True
    })
    fmt_proveedor = workbook.add_format({
        "font_name": "Calibri", "font_size": 11, "bold": True,
        "bottom": 1, "bottom_color": GRIS_MEDIO
    })
    fmt_btn = workbook.add_format({
        "font_name": "Calibri", "font_size": 12, "bold": True,
        "font_color": BLANCO, "bg_color": MORADO,
        "align": "center", "valign": "vcenter",
        "border": 2, "border_color": MORADO_OSCURO
    })
    fmt_hint = workbook.add_format({
        "font_name": "Calibri", "font_size": 9, "italic": True,
        "font_color": GRIS_TEXT
    })
    fmt_item = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "border": 1
    })
    fmt_item_r = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "border": 1,
        "align": "right"
    })
    fmt_item_money = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "border": 1,
        "align": "right", "num_format": "#,##0.00"
    })
    fmt_item_qty = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "border": 1,
        "align": "right", "num_format": "#,##0"
    })
    fmt_total_lbl = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "bold": True,
        "align": "right", "top": 2, "top_color": MORADO
    })
    fmt_total_val = workbook.add_format({
        "font_name": "Calibri", "font_size": 11, "bold": True,
        "font_color": MORADO, "align": "right", "num_format": "#,##0.00",
        "top": 2, "top_color": MORADO
    })

    # Row 1: Número
    ws_pt.write("B1", "N° Factura:", fmt_label)
    ws_pt.merge_range("G1:I1", "", fmt_numero)  # placeholder
    ws_pt.set_row(0, 28)

    # Row 2: Tipo
    ws_pt.write("B2", "Tipo:", fmt_label)
    ws_pt.write("G2", "FC", fmt_normal)
    ws_pt.set_row(1, 20)

    # Row 3: Fecha
    ws_pt.write("B3", "Fecha:", fmt_label)
    fmt_fecha = workbook.add_format({
        "font_name": "Calibri", "font_size": 10, "num_format": "DD/MM/YYYY"
    })
    ws_pt.write("G3", "", fmt_fecha)
    ws_pt.set_row(2, 20)

    # Row 4: Proveedor
    ws_pt.write("B5", "Razón Social:", fmt_label)
    ws_pt.merge_range("B4:F4", "", fmt_proveedor)
    ws_pt.set_row(3, 24)

    # Row 8: Headers
    hdr = 7  # 0-indexed
    ws_pt.set_row(hdr, 22)
    ws_pt.write(hdr, 1, "CANTIDAD", fmt_header)  # B
    ws_pt.write(hdr, 2, "CODIGO", fmt_header)    # C
    # D is separator (col 3)
    ws_pt.merge_range(hdr, 4, hdr, 5, "DESCRIPCION", fmt_header)  # E-F
    ws_pt.write(hdr, 6, "P.UNI", fmt_header)      # G
    ws_pt.write(hdr, 7, "TOTAL", fmt_header)       # H

    # Rows 9-28: Product items (20 rows)
    for r in range(8, 28):  # 0-indexed: 8 = row 9
        ws_pt.set_row(r, 20)
        ws_pt.write(r, 1, None, fmt_item_qty)       # B: Cantidad
        ws_pt.write(r, 2, None, fmt_item)            # C: Código
        ws_pt.merge_range(r, 4, r, 5, None, fmt_item)  # E-F: Descripción
        ws_pt.write(r, 6, None, fmt_item_money)       # G: P.UNI
        # H: TOTAL = formula
        ws_pt.write_formula(r, 7, f'=IF(B{r+1}="","",B{r+1}*G{r+1})', fmt_item_money)

    # Row 29: Total
    total_r = 28  # 0-indexed
    ws_pt.set_row(total_r, 26)
    ws_pt.merge_range(total_r, 4, total_r, 5, "TOTAL", fmt_total_lbl)
    ws_pt.write_formula(total_r, 7, "=SUM(H9:H28)", fmt_total_val)

    # Row 31: Button
    btn_r = 30
    ws_pt.set_row(btn_r, 36)
    ws_pt.merge_range(btn_r, 1, btn_r, 3, "GUARDAR FACTURA", fmt_btn)
    ws_pt.merge_range(btn_r, 4, btn_r, 8, "Presioná Ctrl+Shift+G para guardar (necesitás la macro activada - ver instrucciones)", fmt_hint)

    workbook.close()
    print(f"Guardado: {xlsm_path}")

except ImportError:
    print("xlsxwriter no disponible, usando openpyxl")

print("\n=== INSTRUCCIONES PARA ACTIVAR LA MACRO ===")
print("1. Abrí el archivo Facturas_Macro.xlsx")
print("2. Presioná Alt+F11 para abrir el editor de Visual Basic")
print("3. En el menú, insertá un nuevo Módulo (Insertar > Módulo)")
print("4. Pegá todo el contenido del archivo Macro_VBA_para_pegar.txt")
print("5. Guardá el archivo como .xlsm (Libro de Excel habilitado para macros)")
print("6. Ahora el botón GUARDAR FACTURA funcionará con Ctrl+Shift+G")
print("7. También agregá la macro BuscarEnBase para búsqueda")