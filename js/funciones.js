// VARIABLES GLOBALES DE ESTADO
let miRolActual = "lector"; // Valor por defecto
let listaMiembrosGlobal = [];
let dataEstructuraActual = {};
let ambitoActual = "";
let cargoSeleccionado = "";

// --- 1. VERIFICAR ROL DE USUARIO ---
async function obtenerRolUsuario(uid) {
    try {
        const userDoc = await db.collection("usuarios").doc(uid).get();
        if (userDoc.exists) {
            miRolActual = userDoc.data().rol || "lector";
        } else {
            miRolActual = "lector";
        }
    } catch (error) {
        console.error("Error al obtener el rol del usuario:", error);
        miRolActual = "lector";
    }
    aplicarPermisosUI();
}

// Ocultar o mostrar botones según el rol asignado
function aplicarPermisosUI() {
    const elementosAdmin = document.querySelectorAll(".admin-only");
    elementosAdmin.forEach(el => {
        el.style.display = (miRolActual === "admin") ? "block" : "none";
    });
}

// --- 2. GESTIÓN DE MIEMBROS EN TIEMPO REAL ---
function renderMiembrosTable(filtro = "") {
    const tbody = document.getElementById("tablaMiembrosBody");
    if (!tbody) return;

    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });

        dibujarTablaMiembros(filtro);
        actualizarSelectDesignaciones();
    }, (error) => {
        console.error("Error al consultar miembros:", error);
    });
}

function dibujarTablaMiembros(filtro = "") {
    const tbody = document.getElementById("tablaMiembrosBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtrados = listaMiembrosGlobal.filter(m => 
        (m.nombre && m.nombre.toLowerCase().includes(filtro.toLowerCase())) ||
        (m.apellido && m.apellido.toLowerCase().includes(filtro.toLowerCase())) ||
        (m.cedula && m.cedula.includes(filtro))
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay registros coincidentes</td></tr>`;
        return;
    }

    filtrados.forEach(m => {
        const tr = document.createElement("tr");
        const acciones = miRolActual === "admin" ? `
            <td>
                <button class="btn-edit" onclick="prepararEdicion('${m.id}')">✏️</button>
                <button class="btn-delete" onclick="eliminarMiembro('${m.id}')">❌</button>
            </td>
        ` : `<td><span style="color:#aaa; font-size:0.8rem;">Solo Lectura</span></td>`;

        tr.innerHTML = `
            <td>${m.nombre}</td>
            <td>${m.apellido}</td>
            <td>${m.cedula}</td>
            <td>${m.telefono}</td>
            <td>${m.correo}</td>
            ${acciones}
        `;
        tbody.appendChild(tr);
    });
}

// --- 3. LÓGICA DE ESTRUCTURAS EN TIEMPO REAL ---
function initEstructuraPage(ambito) {
    ambitoActual = ambito;
    
    // Escuchar miembros
    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });
        actualizarSelectDesignaciones();
        if (Object.keys(dataEstructuraActual).length > 0) renderEstructuraTable();
    });

    // Escuchar la estructura del ámbito actual
    db.collection("estructuras").doc(ambitoActual).onSnapshot((doc) => {
        dataEstructuraActual = doc.exists ? doc.data() : {};
        renderEstructuraTable();
    });
}

function renderEstructuraTable() {
    const tabla = document.getElementById("tablaEstructuraBody");
    if (!tabla) return;

    const cargosDisponibles = [
        "Coordinación",
        "Coordinación de Organización",
        "Coordinación de Comunicaciones",
        "Secretaría Política Primera",
        "Secretaría Política Segunda"
    ];

    tabla.innerHTML = "";

    cargosDisponibles.forEach(c => {
        const sufijo = ambitoActual === 'municipal' ? 'Municipal' : 'Parroquial';
        const nombreCargoCompleto = c === "Coordinación" ? `${c} ${sufijo}` : `${c}`;
        const miembroId = dataEstructuraActual[nombreCargoCompleto];
        const m = listaMiembrosGlobal.find(item => item.id === miembroId);

        const tr = document.createElement("tr");

        let celdaAccion = "";
        if (miRolActual === "admin") {
            celdaAccion = m ? `
                <td>
                    <button class="btn-primary" onclick="abrirModalDesignar('${nombreCargoCompleto}')">Cambiar</button>
                    <button class="btn-delete" onclick="removerCargo('${nombreCargoCompleto}')">Vaciar</button>
                </td>
            ` : `
                <td>
                    <button class="btn-primary" onclick="abrirModalDesignar('${nombreCargoCompleto}')">Designar</button>
                </td>
            `;
        } else {
            celdaAccion = `<td><span style="color:#aaa; font-size:0.8rem;">Sin Permiso</span></td>`;
        }

        if (m) {
            tr.innerHTML = `
                <td><b>${nombreCargoCompleto}</b></td>
                <td>${m.nombre}</td>
                <td>${m.apellido}</td>
                <td>${m.cedula}</td>
                <td>${m.correo}</td>
                <td>${m.telefono}</td>
                ${celdaAccion}
            `;
        } else {
            tr.innerHTML = `
                <td><b>${nombreCargoCompleto}</b></td>
                <td colspan="5" class="vacante">Cargo Vacante / Sin Designar</td>
                ${celdaAccion}
            `;
        }
        tabla.appendChild(tr);
    });
}
