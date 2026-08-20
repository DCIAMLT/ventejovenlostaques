// CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCNs1ZDsZ-lJayR2aXjkoASEMVXz4GiAXs",
  authDomain: "ventejovenlostaques.firebaseapp.com",
  projectId: "ventejovenlostaques",
  storageBucket: "ventejovenlostaques.firebasestorage.app",
  messagingSenderId: "314944402934",
  appId: "1:314944402934:web:32558ad1028e504e4683d7"
};

// Inicialización de Firebase (Compatibilidad Web SDK v8/v9)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// CONFIGURACIÓN DE ACCESO
const CEDULA_AUTORIZADA = "11053142";
const USER_STRING = "Bienvenido/a al Sistema de Control Interno de Vente Joven Los Taques";

// Verificar sesión al cargar páginas internas
function verificarSesion(isLoginPage = false) {
    const sesion = localStorage.getItem("sesion_activa");
    if (isLoginPage) {
        if (sesion === "true") {
            window.location.href = "inicio/index.html";
        }
    } else {
        if (sesion !== "true") {
            const pathDepth = window.location.pathname.split('/').length;
            window.location.href = pathDepth > 3 ? "../index.html" : "../index.html";
        } else {
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
        alert("Código de Acceso Único es Incorrecto.");
    }
}

function logout() {
    localStorage.removeItem("sesion_activa");
    const pathDepth = window.location.pathname.split('/').length;
    window.location.href = pathDepth > 3 ? "../index.html" : "../index.html"; 
}

// MENÚ HAMBURGUESA Y DESPLEGABLES
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

// --- GESTIÓN DE MIEMBROS CON FIREBASE (TIEMPO REAL) ---
let miembroEditandoId = null;
let listaMiembrosGlobal = [];

function renderMiembrosTable(filtro = "") {
    const tbody = document.getElementById("tablaMiembrosBody");
    if (!tbody) return;

    // Escuchar cambios en Firestore en tiempo real
    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });

        dibujarTablaMiembros(filtro);
        actualizarSelectDesignaciones();
    }, (error) => {
        console.error("Error consultando miembros: ", error);
    });
}

function dibujarTablaMiembros(filtro = "") {
    const tbody = document.getElementById("tablaMiembrosBody");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    const filtrados = listaMiembrosGlobal.filter(m => 
        m.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        m.apellido.toLowerCase().includes(filtro.toLowerCase()) ||
        m.cedula.includes(filtro)
    );

    if (filtrados.length === 0) {
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

async function guardarMiembroForm(e) {
    e.preventDefault();
    const nombre = document.getElementById("mNombre").value.trim();
    const apellido = document.getElementById("mApellido").value.trim();
    const cedula = document.getElementById("mCedula").value.trim() || "S/D";
    const telefono = document.getElementById("mTelefono").value.trim() || "S/D";
    const correo = document.getElementById("mCorreo").value.trim() || "S/D";

    try {
        if (miembroEditandoId) {
            await db.collection("miembros").doc(miembroEditandoId).update({
                nombre, apellido, cedula, telefono, correo
            });
            miembroEditandoId = null;
            document.getElementById("btnSubmitMiembro").textContent = "Registrar Miembro";
        } else {
            if (cedula !== "S/D" && listaMiembrosGlobal.some(m => m.cedula === cedula)) {
                alert("Esta cédula ya está registrada.");
                return;
            }
            await db.collection("miembros").add({
                nombre, apellido, cedula, telefono, correo, fechaRegistro: new Date()
            });
        }
        document.getElementById("miembroForm").reset();
    } catch (error) {
        alert("Error al guardar en la nube: " + error.message);
    }
}

function prepararEdicion(id) {
    const m = listaMiembrosGlobal.find(item => item.id === id);
    if (!m) return;

    document.getElementById("mNombre").value = m.nombre;
    document.getElementById("mApellido").value = m.apellido;
    document.getElementById("mCedula").value = m.cedula === "S/D" ? "" : m.cedula;
    document.getElementById("mTelefono").value = m.telefono === "S/D" ? "" : m.telefono;
    document.getElementById("mCorreo").value = m.correo === "S/D" ? "" : m.correo;

    miembroEditandoId = id;
    document.getElementById("btnSubmitMiembro").textContent = "Actualizar Datos";
}

async function eliminarMiembro(id) {
    if (!confirm("¿Seguro que deseas eliminar este miembro? Se quitará de cualquier cargo asignado.")) return;

    try {
        await db.collection("miembros").doc(id).delete();
        
        // Limpiar de estructuras si estaba asignado
        const ambitos = ['municipal', 'los_taques', 'judibana'];
        for (let amb of ambitos) {
            const docRef = db.collection("estructuras").doc(amb);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                let actualizo = false;
                for (let cargo in data) {
                    if (data[cargo] === id) {
                        delete data[cargo];
                        actualizo = true;
                    }
                }
                if (actualizo) await docRef.set(data);
            }
        }
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}

// --- LÓGICA DE ESTRUCTURAS EN TIEMPO REAL ---
let ambitoActual = "";
let cargoSeleccionado = "";
let dataEstructuraActual = {};

function initEstructuraPage(ambito) {
    ambitoActual = ambito;
    
    // 1. Escuchar cambios de miembros en tiempo real
    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });

        actualizarSelectDesignaciones();
        
        if (Object.keys(dataEstructuraActual).length > 0) {
            renderEstructuraTable();
        }
    }, (error) => {
        console.error("Error cargando miembros para estructuras: ", error);
    });

    // 2. Escuchar la estructura en tiempo real
    db.collection("estructuras").doc(ambitoActual).onSnapshot((doc) => {
        dataEstructuraActual = doc.exists ? doc.data() : {};
        renderEstructuraTable();
    }, (error) => {
        console.error("Error cargando la estructura: ", error);
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

    listaMiembrosGlobal.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.nombre} ${m.apellido} (${m.cedula})`;
        select.appendChild(opt);
    });
}

async function procesarDesignacion() {
    const select = document.getElementById("selectMiembroDesignar");
    const idMiembro = select.value;
    if (!idMiembro) {
        alert("Por favor selecciona un miembro.");
        return;
    }

    try {
        await db.collection("estructuras").doc(ambitoActual).set({
            [cargoSeleccionado]: idMiembro
        }, { merge: true });
        
        cerrarModal();
    } catch (error) {
        alert("Error al designar cargo: " + error.message);
    }
}

async function removerCargo(cargo) {
    if (!confirm(`¿Deseas dejar vacante el cargo: ${cargo}?`)) return;

    try {
        await db.collection("estructuras").doc(ambitoActual).update({
            [cargo]: firebase.firestore.FieldValue.delete()
        });
    } catch (error) {
        alert("Error al vaciar cargo: " + error.message);
    }
}
