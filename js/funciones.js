// CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCNs1ZDsZ-lJayR2aXjkoASEMVXz4GiAXs",
  authDomain: "ventejovenlostaques.firebaseapp.com",
  projectId: "ventejovenlostaques",
  storageBucket: "ventejovenlostaques.firebasestorage.app",
  messagingSenderId: "314944402934",
  appId: "1:314944402934:web:32558ad1028e504e4683d7"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// VARIABLES GLOBALES
let listaMiembrosGlobal = [];
let dataEstructuraActual = {};
let ambitoActual = "";
let cargoSeleccionado = "";

// --- LOGIN CON FIREBASE Y RECAPTCHA ---
async function login() {
    if (typeof grecaptcha !== 'undefined') {
        const captchaResponse = grecaptcha.getResponse();
        if (captchaResponse.length === 0) {
            alert("Por favor, marca la casilla 'No soy un robot' para continuar.");
            return;
        }
    }

    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value.trim();

    if (!email || !password) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        const currentPath = window.location.pathname;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        window.location.href = basePath + "/inicio/index.html";
    } catch (error) {
        alert("Acceso denegado: Credenciales incorrectas.");
        if (typeof grecaptcha !== 'undefined') {
            grecaptcha.reset();
        }
    }
}

// --- LOGOUT SEGURO ---
function logout() {
    auth.signOut().then(() => {
        const path = window.location.pathname;
        const repositoryPath = path.substring(0, path.indexOf('/', 1));
        window.location.href = repositoryPath + "/index.html";
    });
}

// --- VERIFICADOR DE SESIÓN EN TIEMPO REAL (RUTAS Y RECONOCIMIENTO CORREGIDOS) ---
auth.onAuthStateChanged((user) => {
    const path = window.location.pathname;
    
    // Detecta si estás dentro de alguna carpeta del sistema
    const isInsideApp = path.includes("/inicio/") || 
                        path.includes("/miembros/") || 
                        path.includes("/estructuramunicipal/") || 
                        path.includes("/parroquialostaques/") || 
                        path.includes("/parroquiajudibana/");

    if (user) {
        const badge = document.getElementById("userRoleBadge");
        if (badge) badge.innerText = "Usuario Activo";

        // Si ya inició sesión y está en la raíz, mandarlo a Inicio
        if (!isInsideApp && path.endsWith("index.html")) {
            const basePath = path.substring(0, path.lastIndexOf('/'));
            window.location.href = basePath + "/inicio/index.html";
        }
    } else {
        // Si NO inició sesión y quiere entrar a alguna subcarpeta, mandarlo al login
        if (isInsideApp) {
            const repositoryPath = path.substring(0, path.indexOf('/', 1));
            window.location.href = repositoryPath + "/index.html";
        }
    }
});

// --- PANEL PRINCIPAL (RESUMEN) ---
function initDashboard() {
    db.collection("miembros").onSnapshot((snapshotMiembros) => {
        const totalMiembros = snapshotMiembros.size;
        const statTotal = document.getElementById("statTotalMiembros");
        if (statTotal) statTotal.innerText = totalMiembros;

        db.collection("estructuras").onSnapshot((snapshotEstructuras) => {
            let cargosOcupados = 0;
            let personasUnicasConCargo = new Set();

            snapshotEstructuras.forEach(doc => {
                const data = doc.data();
                Object.values(data).forEach(miembroId => {
                    if (miembroId) {
                        cargosOcupados++;
                        personasUnicasConCargo.add(miembroId);
                    }
                });
            });

            const statCargos = document.getElementById("statCargosOcupados");
            const statPersonas = document.getElementById("statPersonasConCargo");

            if (statCargos) statCargos.innerText = `${cargosOcupados} / 15`;
            if (statPersonas) statPersonas.innerText = personasUnicasConCargo.size;
        });
    });
}

// --- GESTIÓN DE MIEMBROS ---
function renderMiembrosTable() {
    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });
        dibujarTablaMiembros();
    });
}

function dibujarTablaMiembros() {
    const tbody = document.getElementById("tablaMiembrosBody");
    if (!tbody) return;

    const filtro = document.getElementById("searchMiembro") ? document.getElementById("searchMiembro").value.toLowerCase() : "";
    tbody.innerHTML = "";

    const filtrados = listaMiembrosGlobal.filter(m => 
        (m.nombre && m.nombre.toLowerCase().includes(filtro)) ||
        (m.apellido && m.apellido.toLowerCase().includes(filtro)) ||
        (m.cedula && m.cedula.includes(filtro))
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay registros coincidentes</td></tr>`;
        return;
    }

    filtrados.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.nombre || ''}</td>
            <td>${m.apellido || ''}</td>
            <td>${m.cedula || 'N/A'}</td>
            <td>${m.telefono || 'N/A'}</td>
            <td>${m.correo || 'N/A'}</td>
            <td>
                <button class="btn-edit" onclick="prepararEdicion('${m.id}')">✏️ Editar</button>
                <button class="btn-delete" onclick="eliminarMiembro('${m.id}')">❌ Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarMiembros() {
    dibujarTablaMiembros();
}

async function guardarMiembro(e) {
    e.preventDefault();
    const id = document.getElementById("miembroIdEdit").value;
    const nombre = document.getElementById("nombreInput").value.trim();
    const apellido = document.getElementById("apellidoInput").value.trim();
    const cedula = document.getElementById("cedulaInput").value.trim();
    const telefono = document.getElementById("telefonoInput").value.trim();
    const correo = document.getElementById("correoInput").value.trim();

    if (!nombre || !apellido) {
        alert("El nombre y el apellido son obligatorios.");
        return;
    }

    const payload = { nombre, apellido, cedula, telefono, correo };

    try {
        if (id) {
            await db.collection("miembros").doc(id).update(payload);
            alert("Miembro actualizado correctamente.");
        } else {
            await db.collection("miembros").add(payload);
            alert("Miembro agregado con éxito.");
        }

        document.getElementById("miembroForm").reset();
        document.getElementById("miembroIdEdit").value = "";
        document.getElementById("btnGuardarMiembro").innerText = "Guardar Miembro";
        document.getElementById("formTitle").innerText = "Agregar Nuevo Miembro";
        
        if (typeof switchTab === 'function') switchTab('listaTab');
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

function prepararEdicion(id) {
    const m = listaMiembrosGlobal.find(item => item.id === id);
    if (!m) return;

    document.getElementById("miembroIdEdit").value = m.id;
    document.getElementById("nombreInput").value = m.nombre || "";
    document.getElementById("apellidoInput").value = m.apellido || "";
    document.getElementById("cedulaInput").value = m.cedula || "";
    document.getElementById("telefonoInput").value = m.telefono || "";
    document.getElementById("correoInput").value = m.correo || "";

    document.getElementById("btnGuardarMiembro").innerText = "Actualizar Datos";
    document.getElementById("formTitle").innerText = "Editar Datos del Miembro";

    if (typeof switchTab === 'function') switchTab('formTab');
}

async function eliminarMiembro(id) {
    if (confirm("¿Estás seguro de que deseas eliminar a este miembro?")) {
        try {
            await db.collection("miembros").doc(id).delete();
        } catch (error) {
            alert("Error al eliminar: " + error.message);
        }
    }
}

// --- ESTRUCTURAS ---
function initEstructuraPage(ambito) {
    ambitoActual = ambito;
    
    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });
        if (Object.keys(dataEstructuraActual).length > 0) renderEstructuraTable();
    });

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

        const celdaAccion = m ? `
            <td>
                <button class="btn-primary" onclick="abrirModalDesignar('${nombreCargoCompleto}')">Reemplazar</button>
                <button class="btn-delete" onclick="removerCargo('${nombreCargoCompleto}')">Vaciar</button>
            </td>
        ` : `
            <td>
                <button class="btn-primary" onclick="abrirModalDesignar('${nombreCargoCompleto}')">Designar</button>
            </td>
        `;

        if (m) {
            tr.innerHTML = `
                <td><b>${nombreCargoCompleto}</b></td>
                <td>${m.nombre || ''}</td>
                <td>${m.apellido || ''}</td>
                <td>${m.cedula || 'N/A'}</td>
                <td>${m.correo || 'N/A'}</td>
                <td>${m.telefono || 'N/A'}</td>
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

// --- MODAL DE DESIGNACIÓN Y REEMPLAZO ---
function abrirModalDesignar(cargo) {
    cargoSeleccionado = cargo;
    const modal = document.getElementById("modalCargo");
    const select = document.getElementById("selectMiembroDesignar");
    const titulo = document.getElementById("modalCargoTitulo");

    if (!modal || !select) return;

    titulo.innerText = `Asignar: ${cargo}`;
    select.innerHTML = `<option value="">-- Selecciona un Miembro --</option>`;

    listaMiembrosGlobal.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.nombre} ${m.apellido} (${m.cedula || 'Sin Cédula'})</option>`;
    });

    modal.style.display = "flex";
}

function cerrarModal() {
    const modal = document.getElementById("modalCargo");
    if (modal) modal.style.display = "none";
}

async function confirmarDesignacion() {
    const select = document.getElementById("selectMiembroDesignar");
    const miembroId = select.value;

    if (!miembroId) {
        alert("Por favor selecciona a una persona de la lista.");
        return;
    }

    try {
        await db.collection("estructuras").doc(ambitoActual).set({
            [cargoSeleccionado]: miembroId
        }, { merge: true });

        cerrarModal();
    } catch (error) {
        alert("Error al actualizar cargo: " + error.message);
    }
}

async function removerCargo(cargo) {
    if (confirm(`¿Deseas dejar vacante el cargo ${cargo}?`)) {
        try {
            await db.collection("estructuras").doc(ambitoActual).set({
                [cargo]: firebase.firestore.FieldValue.delete()
            }, { merge: true });
        } catch (error) {
            alert("Error al vaciar cargo: " + error.message);
        }
    }
}

// --- INTERFAZ, NAVEGACIÓN Y EXPORTACIÓN ---
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
}

function actualizarTimestampUI() {
    const el = document.getElementById("timestampActualizacion");
    if (!el) return;
    
    const ahora = new Date();
    const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const fecha = ahora.toLocaleDateString('es-ES', opcionesFecha);
    const hora = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    el.innerText = `Última actualización: ${fecha} - ${hora}`;
}

function descargarPDF() {
    const elemento = document.getElementById("areaExportar");
    const titulo = document.getElementById("tituloPagina") ? document.getElementById("tituloPagina").innerText : "Reporte";

    const acciones = elemento.querySelectorAll("button, .btn-primary, .btn-delete, .btn-edit");
    acciones.forEach(el => el.style.visibility = "hidden");

    const opciones = {
        margin: [10, 10, 10, 10],
        filename: `${titulo.replace(/\s+/g, '_')}_VenteJoven.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opciones).from(elemento).save().then(() => {
        acciones.forEach(el => el.style.visibility = "visible");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    actualizarTimestampUI();
});
