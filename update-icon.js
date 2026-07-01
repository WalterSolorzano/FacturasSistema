const { rcedit } = require('rcedit');

(async () => {
    try {
        await rcedit('./FacturasPortable/SistemaFacturas.exe', {
            icon: './icon.ico'
        });
        console.log("Icon updated successfully");
    } catch (e) {
        console.error("Error updating icon:", e);
    }
})();
