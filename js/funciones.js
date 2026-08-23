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
let miRolActual = "lector";
let listaMiembrosGlobal = [];
let dataEstructuraActual = {};
let ambitoActual = "";
let cargoSeleccionado = "";

// --- LOGIN CON FIREBASE Y RECAPTCHA ---
async function login() {
    // 1. Validar si reCAPTCHA está resuelto
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
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await obtenerRolUsuario(userCredential.user.uid);
        
        // Redirección dinámica según la ubicación actual
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

// --- VERIFICADOR DE SESIÓN EN TIEMPO REAL (RUTAS CORREGIDAS) ---
auth.onAuthStateChanged(async (user) => {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith("index.html") && !path.includes("/inicio/") && !path.includes("/miembros/");

    if (user) {
        await obtenerRolUsuario(user.uid);
        if (isLoginPage) {
            const basePath = path.substring(0, path.lastIndexOf('/'));
            window.location.href = basePath + "/inicio/index.html";
        }
    } else {
        if (!isLoginPage) {
            const repositoryPath = path.substring(0, path.indexOf('/', 1));
            window.location.href = repositoryPath + "/index.html";
        }
    }
});

// --- ROL DE USUARIO ---
async function obtenerRolUsuario(uid) {
    try {
        const userDoc = await db.collection("usuarios").doc(uid).get();
        if (userDoc.exists) {
            miRolActual = userDoc.data().rol || "lector";
        } else {
            miRolActual = "lector";
        }
    } catch (error) {
        console.error("Error obteniendo rol:", error);
        miRolActual = "lector";
    }
    aplicarPermisosUI();
}

function aplicarPermisosUI() {
    const elementosAdmin = document.querySelectorAll(".admin-only");
    elementosAdmin.forEach(el => {
        el.style.display = (miRolActual === "admin") ? "block" : "none";
    });
}

// --- GESTIÓN DE MIEMBROS ---
function renderMiembrosTable(filtro = "") {
    const tbody = document.getElementById("tablaMiembrosBody");
    if (!tbody) return;

    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });

        dibujarTablaMiembros(filtro);
        if (typeof actualizarSelectDesignaciones === 'function') {
            actualizarSelectDesignaciones();
        }
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
            <td>${m.nombre || ''}</td>
            <td>${m.apellido || ''}</td>
            <td>${m.cedula || ''}</td>
            <td>${m.telefono || ''}</td>
            <td>${m.correo || ''}</td>
            ${acciones}
        `;
        tbody.appendChild(tr);
    });
}

// --- ESTRUCTURAS ---
function initEstructuraPage(ambito) {
    ambitoActual = ambito;
    
    db.collection("miembros").onSnapshot((snapshot) => {
        listaMiembrosGlobal = [];
        snapshot.forEach(doc => {
            listaMiembrosGlobal.push({ id: doc.id, ...doc.data() });
        });
        if (typeof actualizarSelectDesignaciones === 'function') {
            actualizarSelectDesignaciones();
        }
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
                <td>${m.nombre || ''}</td>
                <td>${m.apellido || ''}</td>
                <td>${m.cedula || ''}</td>
                <td>${m.correo || ''}</td>
                <td>${m.telefono || ''}</td>
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
// --- FUNCIONES INTERFAZ Y NAVEGACIÓN ---

// Abre y cierra el menú lateral de 3 rayas
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("active");
    }
}

// Cierra el menú si se hace clic fuera de él
document.addEventListener("click", (e) => {
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.querySelector(".menu-toggle");
    if (sidebar && sidebar.classList.contains("active")) {
        if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
            sidebar.classList.remove("active");
        }
    }
});

// Formatea e inyecta la fecha/hora de última actualización
function actualizarTimestampUI() {
    const el = document.getElementById("timestampActualizacion");
    if (!el) return;
    
    const ahora = new Date();
    const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const fecha = ahora.toLocaleDateString('es-ES', opcionesFecha);
    const hora = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    el.innerText = `Última actualización: ${fecha} - ${hora}`;
}

// Inicializar componentes al cargar
document.addEventListener("DOMContentLoaded", () => {
    actualizarTimestampUI();
});
