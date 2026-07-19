// CONFIGURACIÓN DE ACCESO DE DIEGO
const CEDULA_AUTORIZADA = "31422303";
const USER_STRING = "Bienvenido: Diego García (V-31.422.303) - Coordinador Municipal de Vente Joven Los Taques";

// Verificar sesión al cargar páginas internas
function verificarSesion(isLoginPage = false) {
    const sesion = localStorage.getItem("sesion_activa");
    if (isLoginPage) {
        if (sesion === "true") {
            window.location.href = "inicio/index.html";
        }
    } else {
        if (sesion !== "true") {
            // Reajustar ruta si estamos en subcarpetas
            const pathDepth = window.location.pathname.split('/').length;
            if(pathDepth > 3) {
                window.location.href = "../index.html";
            } else {
                window.location.href = "../index.html";
            }
        } else {
            // Insertar info de usuario en el header
            const container = document.getElementById("userInfo");
            if (container) container.textContent = USER_STRING;
        }
    }
}

// LOGIN LOGIC
function login() {
    const cedulaInput = document.getElementById("cedulaInput").value.trim();
    if (cedulaInput === CEDULA_AUTORIZADA) {
        localStorage.setItem("sesion_activa", "true");
        window.location.href = "inicio/index.html";
    } else {
        alert("Cédula no autorizada para el control interno municipal.");
    }
}

function logout() {
    localStorage.removeItem("sesion_activa");
    const pathDepth = window.location.pathname.split('/').length;
    window.location.href = pathDepth > 3 ? "../index.html" : "../index.html"; 
}

// INTERFAZ DE MENÚ HAMBURGUESA Y DESPLEGABLES
document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const closeSidebar = document.getElementById("closeSidebar");

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => sidebar.classList.add("active"));
    }
    if (closeSidebar && sidebar) {
        closeSidebar.addEventListener("click", () => sidebar.classList.remove("active"));
    }

    // Lógica de submenús colapsables por niveles
    const dropdowns = document.querySelectorAll(".has-children > a");
    dropdowns.forEach(trigger => {
        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            const nextSubmenu = trigger.nextElementSibling;
            if (nextSubmenu) {
                nextSubmenu.classList.toggle("show");
            }
        });
    });
});

// --- GESTIÓN DE DATA (LOCALSTORAGE) ---
function getMiembros() {
    return JSON.parse(localStorage.getItem("vj_miembros")) || [];
}

function saveMiembros(data) {
    localStorage.setItem("vj_miembros", JSON.stringify(data));
}

function getEstructuras() {
    return JSON.parse(localStorage.getItem("vj_estructuras")) || {
        municipal: {},
        los_taques: {},
        judibana: {}
    };
}

function saveEstructuras(data) {
    localStorage.setItem("vj_estructuras", JSON.stringify(data));
}

// --- LOGICA DE LA PÁGINA DE MIEMBROS ---
let miembroEditandoId = null;

function renderMiembrosTable(filtro = "") {
    const tbody = document.getElementById("tablaMiembrosBody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    const miembros = getMiembros();
    
    const filtrados = miembros.filter(m => 
        m.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        m.apellido.toLowerCase().includes(filtro.toLowerCase()) ||
        m.cedula.includes(filtro)
    );

    if(filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay registros coincidentes</td></tr>`;
        return;
    }

    filtrados.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.nombre}</td>
            <td>${m.apellido}</td>
            <td>${m.cedula}</td>
            <td>${m.telefono}</td>
            <td>${m.correo}</td>
            <td>
                <button class="btn-edit" onclick="prepararEdicion('${m.id}')">✏️</button>
                <button class="btn-delete" onclick="eliminarMiembro('${m.id}')">❌</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function guardarMiembroForm(e) {
    e.preventDefault();
    const nombre = document.getElementById("mNombre").value.trim();
    const apellido = document.getElementById("mApellido").value.trim();
    const cedula = document.getElementById("mCedula").value.trim();
    const telefono = document.getElementById("mTelefono").value.trim();
    const correo = document.getElementById("mCorreo").value.trim();

    let miembros = getMiembros();

    if (miembroEditandoId) {
        miembros = miembros.map(m => m.id === miembroEditandoId ? { id: m.id, nombre, apellido, cedula, telefono, correo } : m);
        miembroEditandoId = null;
        document.getElementById("btnSubmitMiembro").textContent = "Registrar Miembro";
    } else {
        if(miembros.some(m => m.cedula === cedula)) {
            alert("Esta cédula ya está registrada.");
            return;
        }
        const nuevo = { id: 'm_' + Date.now(), nombre, apellido, cedula, telefono, correo };
        miembros.push(nuevo);
    }

    saveMiembros(miembros);
    document.getElementById("miembroForm").reset();
    renderMiembrosTable();
    actualizarSelectDesignaciones();
}

function prepararEdicion(id) {
    const miembros = getMiembros();
    const m = miembros.find(item => item.id === id);
    if (!m) return;

    document.getElementById("mNombre").value = m.nombre;
    document.getElementById("mApellido").value = m.apellido;
    document.getElementById("mCedula").value = m.cedula;
    document.getElementById("mTelefono").value = m.telefono;
    document.getElementById("mCorreo").value = m.correo;

    miembroEditandoId = id;
    document.getElementById("btnSubmitMiembro").textContent = "Actualizar Datos";
}

function eliminarMiembro(id) {
    if (!confirm("¿Seguro que deseas eliminar este miembro? Se quitará de cualquier cargo asignado.")) return;
    
    let miembros = getMiembros();
    miembros = miembros.filter(m => m.id !== id);
    saveMiembros(miembros);

    // Limpiar de las estructuras si estaba asignado
    let estructuras = getEstructuras();
    ['municipal', 'los_taques', 'judibana'].forEach(amb => {
        for (let cargo in estructuras[amb]) {
            if (estructuras[amb][cargo] === id) {
                delete estructuras[amb][cargo];
            }
        }
    });
    saveEstructures(estructuras);

    renderMiembrosTable();
}

// --- LOGICA DE ESTRUCTURAS ---
let ambitoActual = "";
let cargoSeleccionado = "";

function initEstructuraPage(ambito) {
    ambitoActual = ambito;
    renderEstructuraTable();
}

function renderEstructuraTable() {
    const tabla = document.getElementById("tablaEstructuraBody");
    if (!tabla) return;

    const estructuras = getEstructuras();
    const miembros = getMiembros();
    const dataAmbito = estructuras[ambitoActual] || {};

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

        const miembroId = dataAmbito[nombreCargoCompleto];
        const m = miembros.find(item => item.id === miembroId);

        const tr = document.createElement("tr");
        if (m) {
            tr.innerHTML = `
                <td><b>${nombreCargoCompleto}</b></td>
                <td>${m.nombre}</td>
                <td>${m.apellido}</td>
                <td>${m.cedula}</td>
                <td>${m.correo}</td>
                <td>${m.telefono}</td>
                <td>
                    <button class="btn-action btn-designar" onclick="abrirModalDesignar('${nombreCargoCompleto}')">Cambiar</button>
                    <button class="btn-action btn-remover" onclick="removerCargo('${nombreCargoCompleto}')">Vaciar</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td><b>${nombreCargoCompleto}</b></td>
                <td colspan="5" class="vacante">Cargo Vacante / Sin Designar</td>
                <td>
                    <button class="btn-action btn-designar" onclick="abrirModalDesignar('${nombreCargoCompleto}')">Designar</button>
                </td>
            `;
        }
        tabla.appendChild(tr);
    });
}

function abrirModalDesignar(cargo) {
    cargoSeleccionado = cargo;
    actualizarSelectDesignaciones();
    document.getElementById("modalDesignar").style.display = "flex";
}

function cerrarModal() {
    document.getElementById("modalDesignar").style.display = "none";
}

function actualizarSelectDesignaciones() {
    const select = document.getElementById("selectMiembroDesignar");
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecciona un miembro militante --</option>';
    
    const miembros = getMiembros();
    miembros.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.nombre} ${m.apellido} (${m.cedula})`;
        select.appendChild(opt);
    });
}

function procesarDesignacion() {
    const select = document.getElementById("selectMiembroDesignar");
    const idMiembro = select.value;
    if(!idMiembro) {
        alert("Por favor selecciona un miembro.");
        return;
    }

    let estructuras = getEstructuras();
    estructuras[ambitoActual][cargoSeleccionado] = idMiembro;
    saveEstructures(estructuras);
    
    cerrarModal();
    renderEstructuraTable();
}

function removerCargo(cargo) {
    if(!confirm(`¿Deseas dejar vacante el cargo: ${cargo}?`)) return;
    let estructuras = getEstructuras();
    delete estructuras[ambitoActual][cargo];
    saveEstructures(estructuras);
    renderEstructuraTable();
}
