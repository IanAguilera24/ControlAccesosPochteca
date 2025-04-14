// Variables globales
let db;
let auth;
let currentUserRole = null;
let currentUserBranch = null;
let sucursal;
let entryTime;
let visitorType;
let clientFields;
let visitorFields;
let observations;
let pendingBody;
let completedBody;
let searchInput;
let exportBtn;

// Inicialización de Firebase
async function initializeFirebase() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    db = firebase.firestore();
    auth = firebase.auth();
}

// Redirección al login si no hay autenticación
function redirectToLogin() {
    window.location.href = '../login.html';
}

// Verificar autenticación y roles
async function checkAuth() {
    try {
        await initializeFirebase();
        
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                redirectToLogin();
                return;
            }

            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            
            if (!userDoc.exists) {
                await auth.signOut();
                redirectToLogin();
                return;
            }

            // Obtener y almacenar el rol y la sucursal del usuario
            const userData = userDoc.data();
            currentUserRole = userData.rol;
            currentUserBranch = userData.sucursal || "";
            
            const currentPage = window.location.pathname.split('/').pop();

            // Definir páginas permitidas para cada rol
            const allowedPages = {
                admin: ['administrador.html', 'guardia.html'],
                guardia: ['guardia.html']
            };

            // Verificar si el rol tiene acceso a la página actual
            if (!allowedPages[currentUserRole]?.includes(currentPage)) {
                await auth.signOut();
                redirectToLogin();
                return;
            }

            // Iniciar la aplicación si todo está correcto
            startApplication();
            adjustUIForRole(); // Ajustar la interfaz según el rol
        });
    } catch (error) {
        console.error('Error en verificación de autenticación:', error);
        redirectToLogin();
    }
}

// Inicializar las referencias a elementos DOM
function initializeDOM() {
    sucursal = document.getElementById('sucursal');
    entryTime = document.getElementById('entryTime');
    visitorType = document.getElementsByName('visitorType');
    clientFields = document.getElementById('clientFields');
    visitorFields = document.getElementById('visitorFields');
    observations = document.getElementById('observations');
    pendingBody = document.getElementById('pendingBody');
    completedBody = document.getElementById('completedBody');
    searchInput = document.getElementById('searchInput');
    exportBtn = document.getElementById('exportBtn');
}

// Ajustar la interfaz según el rol del usuario
function adjustUIForRole() {
    // Mostrar indicador de rol
    const roleIndicator = document.createElement('div');
    roleIndicator.className = 'role-indicator';
    roleIndicator.textContent = `Rol: ${currentUserRole === 'admin' ? 'Administrador' : 'Guardia'}`;
    document.querySelector('header').appendChild(roleIndicator);
    
    // Mostrar la sucursal del usuario (si tiene)
    if (currentUserBranch) {
        const branchIndicator = document.createElement('div');
        branchIndicator.className = 'role-indicator branch-indicator';
        branchIndicator.style.top = '60px'; // Colocar debajo del indicador de rol
        branchIndicator.textContent = `Sucursal: ${currentUserBranch}`;
        document.querySelector('header').appendChild(branchIndicator);
    }
    
    if (currentUserRole !== 'admin') {
        exportBtn.style.display = 'none';
    }
}

// Configurar listeners de eventos
function setupEventListeners() {
    // Cambiar entre campos de cliente y visitante
    for (let i = 0; i < visitorType.length; i++) {
        visitorType[i].addEventListener('change', function() {
            if (this.value === 'Cliente') {
                clientFields.style.display = 'block';
                visitorFields.style.display = 'none';
            } else {
                clientFields.style.display = 'none';
                visitorFields.style.display = 'block';
            }
        });
    }
    
    // Evento para registrar entrada
    document.getElementById('registerEntryBtn').addEventListener('click', registerEntry);
    
    // Evento para buscar registros
    searchInput.addEventListener('input', function() {
        displayRecords(this.value);
    });
    
    // Evento para exportar registros
    exportBtn.addEventListener('click', exportToExcel);
}

// Actualizar la hora de entrada
function updateEntryTime() {
    const now = new Date();
    const formattedTime = formatDateTime(now);
    entryTime.value = formattedTime;
}

// Formatear fecha y hora
function formatDateTime(date) {
    const options = { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('es-MX', options);
}

// Registrar entrada
async function registerEntry() {
    try {
        // Validar formulario
        const selectedType = Array.from(visitorType).find(radio => radio.checked).value;
        
        if (!sucursal.value) {
            alert('Por favor, seleccione una sucursal.');
            return;
        }
        
        let visitorData = {
            type: selectedType,
            sucursal: sucursal.value,
            entryTime: firebase.firestore.Timestamp.now(),
            observations: observations.value
        };
        
        if (selectedType === 'Cliente') {
            const companyName = document.getElementById('companyName').value;
            const clientPersonName = document.getElementById('clientPersonName').value;
            const product = document.getElementById('product').value;
            
            if (!clientPersonName) {
                alert('Por favor, ingrese el nombre de la persona.');
                return;
            }
            
            visitorData = {
                ...visitorData,
                companyName,
                clientPersonName,
                product
            };
        } else { // Visitante
            const visitorName = document.getElementById('visitorName').value;
            const visitPurpose = document.getElementById('visitPurpose').value;
            const personToVisit = document.getElementById('personToVisit').value;
            const area = document.getElementById('area').value;
            
            if (!visitorName || !visitPurpose || !personToVisit) {
                alert('Por favor, complete todos los campos obligatorios.');
                return;
            }
            
            visitorData = {
                ...visitorData,
                visitorName,
                visitPurpose,
                personToVisit,
                area
            };
        }
        
        // Guardar en Firestore
        await db.collection('registros_visitantes').add(visitorData);
        
        // Limpiar formulario
        document.getElementById('registrationForm').reset();
        observations.value = '';
        updateEntryTime();
        
        // Configurar el campo de sucursal con la sucursal del usuario
        if (currentUserBranch) {
            for(let i = 0; i < sucursal.options.length; i++) {
                if(sucursal.options[i].value === currentUserBranch) {
                    sucursal.selectedIndex = i;
                    break;
                }
            }
        }
        
        // Actualizar la lista de registros
        displayRecords();
        
        alert('Entrada registrada con éxito.');
    } catch (error) {
        console.error('Error al registrar entrada:', error);
        alert('Error al registrar entrada: ' + error.message);
    }
}

// Registrar salida
async function registerExit(recordId) {
    try {
        await db.collection('registros_visitantes').doc(recordId).update({
            exitTime: firebase.firestore.Timestamp.now()
        });
        
        displayRecords(searchInput.value);
        alert('Salida registrada con éxito.');
    } catch (error) {
        console.error('Error al registrar salida:', error);
        alert('Error al registrar salida: ' + error.message);
    }
}

// Obtener el nombre a mostrar según el tipo de visitante
function getDisplayName(record) {
    if (record.type === 'Cliente') {
        return record.companyName ? `${record.companyName} - ${record.clientPersonName}` : record.clientPersonName;
    } else {
        return record.visitorName;
    }
}

// Agregar un registro pendiente a la tabla
function addPendingRecord(record) {
    const displayName = getDisplayName(record);
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${record.type}</td>
        <td>${displayName}</td>
        <td>${record.sucursal}</td>
        <td>${formatTimestamp(record.entryTime)}</td>
        <td>
            <button class="action-btn view-btn" onclick="viewDetails('${record.id}')">Ver detalles</button>
        </td>
        <td class="actions-cell">
            <button class="action-btn check-out-btn" onclick="registerExit('${record.id}')">Registrar Salida</button>
        </td>
    `;
    
    pendingBody.appendChild(row);
}

// Agregar un registro completado a la tabla
function addCompletedRecord(record) {
    const displayName = getDisplayName(record);
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${record.type}</td>
        <td>${displayName}</td>
        <td>${record.sucursal}</td>
        <td>${formatTimestamp(record.entryTime)}</td>
        <td>${formatTimestamp(record.exitTime)}</td>
        <td>
            <button class="action-btn view-btn" onclick="viewDetails('${record.id}')">Ver detalles</button>
        </td>
    `;
    
    completedBody.appendChild(row);
}

// Formatear timestamp de Firestore
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    return formatDateTime(timestamp.toDate());
}

// Cambiar entre pestañas
function openTab(tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
    }
    
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    document.getElementById(tabName).style.display = 'block';
    event.currentTarget.classList.add('active');
}

// Mostrar detalles de un registro
async function viewDetails(recordId) {
    try {
        const doc = await db.collection('registros_visitantes').doc(recordId).get();
        
        if (!doc.exists) {
            alert('El registro ya no existe.');
            return;
        }
        
        const record = doc.data();
        let details = '';
        
        // Datos comunes
        details += `Tipo: ${record.type}\n`;
        details += `Sucursal: ${record.sucursal}\n`;
        details += `Entrada: ${formatTimestamp(record.entryTime)}\n`;
        
        if (record.exitTime) {
            details += `Salida: ${formatTimestamp(record.exitTime)}\n`;
        }
        
        // Datos específicos según tipo
        if (record.type === 'Cliente') {
            if (record.companyName) details += `Razón Social: ${record.companyName}\n`;
            details += `Nombre: ${record.clientPersonName}\n`;
            if (record.product) details += `Producto: ${record.product}\n`;
        } else {
            details += `Nombre: ${record.visitorName}\n`;
            details += `Motivo: ${record.visitPurpose}\n`;
            details += `Persona a visitar: ${record.personToVisit}\n`;
            if (record.area) details += `Área: ${record.area}\n`;
        }
        
        // Observaciones
        if (record.observations) {
            details += `\nObservaciones: ${record.observations}\n`;
        }
        
        alert(details);
    } catch (error) {
        console.error('Error al obtener detalles:', error);
        alert('Error al obtener detalles: ' + error.message);
    }
}

// Exportar registros a Excel
function exportToExcel() {
    try {
        // Obtener fecha formateada para el nombre del archivo
        const today = new Date();
        const formattedDate = today.toLocaleDateString('es-MX').replace(/\//g, '-');
        
        // Crear una hoja de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Obtener datos de las tablas
        const pendingTable = document.getElementById('pendingTable');
        const completedTable = document.getElementById('completedTable');
        
        // Crear hojas de trabajo para cada tabla
        const pendingWs = XLSX.utils.table_to_sheet(pendingTable);
        const completedWs = XLSX.utils.table_to_sheet(completedTable);
        
        // Añadir las hojas al libro
        XLSX.utils.book_append_sheet(workbook, pendingWs, 'Entradas sin salida');
        XLSX.utils.book_append_sheet(workbook, completedWs, 'Entradas con salida');
        
        // Generar archivo Excel
        XLSX.writeFile(workbook, `Registros_Acceso_${formattedDate}.xlsx`);
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        alert('Error al exportar a Excel: ' + error.message);
    }
}

// Iniciar la aplicación
function startApplication() {
    initializeDOM();
    setupEventListeners();
    
    // Configurar el filtro de fecha para que por defecto muestre el día actual
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // Usa el formato que corresponda a tu input
    if (document.getElementById('dateFilter').type === 'date') {
        document.getElementById('dateFilter').value = `${year}-${month}-${day}`;
    } else {
        document.getElementById('dateFilter').value = `${day}/${month}/${year}`;
    }
    
    // Agregar evento al filtro de fecha
    document.getElementById('dateFilter').addEventListener('change', function() {
        displayRecords(document.getElementById('searchInput').value);
    });
    
    // Agregar control de filtro de sucursal en la interfaz
    addBranchFilter();
    
    // Establecer la sucursal del usuario como predeterminada en el formulario
    if (currentUserBranch && sucursal) {
        for(let i = 0; i < sucursal.options.length; i++) {
            if(sucursal.options[i].value === currentUserBranch) {
                sucursal.selectedIndex = i;
                break;
            }
        }
    }
    
    displayRecords();
    updateEntryTime();
    setInterval(updateEntryTime, 60000);
}

// Función para añadir el filtro de sucursal a la interfaz
function addBranchFilter() {
    const controlsContainer = document.querySelector('.controls-container');
    
    const branchFilterContainer = document.createElement('div');
    branchFilterContainer.className = 'branch-filter-container';
    branchFilterContainer.innerHTML = `
        <label for="branchFilter">Filtrar por sucursal:</label>
        <select id="branchFilter">
            <option value="">Todas las sucursales</option>
        </select>
    `;
    
    controlsContainer.appendChild(branchFilterContainer);
    
    // Copiar las opciones de sucursal del formulario al filtro
    const sucursalSelect = document.getElementById('sucursal');
    const branchFilter = document.getElementById('branchFilter');
    
    for(let i = 1; i < sucursalSelect.options.length; i++) {
        const option = document.createElement('option');
        option.value = sucursalSelect.options[i].value;
        option.textContent = sucursalSelect.options[i].textContent;
        branchFilter.appendChild(option);
    }
    
    // Si el usuario tiene una sucursal, seleccionarla por defecto
    if (currentUserBranch) {
        for(let i = 0; i < branchFilter.options.length; i++) {
            if(branchFilter.options[i].value === currentUserBranch) {
                branchFilter.selectedIndex = i;
                break;
            }
        }
    }
    
    // Agregar listener para el filtro de sucursal
    branchFilter.addEventListener('change', function() {
        displayRecords(document.getElementById('searchInput').value);
    });
}

// Mostrar registros
async function displayRecords(filter = '') {
    const dateFilter = document.getElementById('dateFilter').value;
    const branchFilter = document.getElementById('branchFilter')?.value || '';
    
    document.getElementById('pendingBody').innerHTML = '';
    document.getElementById('completedBody').innerHTML = '';
    
    try {
        // Determinar la fecha seleccionada
        let selectedDate;
        
        if (dateFilter) {
            // Analizar la fecha según el formato que esté usando el input
            if (dateFilter.includes('-')) {
                // Formato YYYY-MM-DD
                const [year, month, day] = dateFilter.split('-');
                selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else if (dateFilter.includes('/')) {
                // Formato DD/MM/YYYY
                const [day, month, year] = dateFilter.split('/');
                selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                // Formato fallback
                selectedDate = new Date(dateFilter);
            }
        } else {
            // Si no hay fecha, usar la fecha actual
            selectedDate = new Date();
            
            // Actualizar el campo de fecha con el día actual
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            
            // Usar el formato que corresponda a tu input
            if (document.getElementById('dateFilter').type === 'date') {
                document.getElementById('dateFilter').value = `${year}-${month}-${day}`;
            } else {
                document.getElementById('dateFilter').value = `${day}/${month}/${year}`;
            }
        }
        
        // Crear fechas de inicio y fin para el día seleccionado
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        
        console.log("Filtrando desde:", startDate.toString());
        console.log("Hasta:", endDate.toString());
        
        // Convertir a timestamps de Firebase
        const startTimestamp = firebase.firestore.Timestamp.fromDate(startDate);
        const endTimestamp = firebase.firestore.Timestamp.fromDate(endDate);
        
        // Construir la consulta con timestamps
        let query = db.collection("registros_visitantes")
            .where("entryTime", ">=", startTimestamp)
            .where("entryTime", "<=", endTimestamp);
            
        // Ejecutamos la consulta
        const querySnapshot = await query.orderBy("entryTime", "desc").get();
        
        // Si hay un filtro de sucursal, filtramos los resultados
        let processedDocs = querySnapshot.docs;
        
        if (branchFilter) {
            processedDocs = querySnapshot.docs.filter(doc => {
                const record = doc.data();
                return record.sucursal === branchFilter;
            });
        }
        
        // Si no hay registros
        if (processedDocs.length === 0) {
            const noRecordsMsg = `<tr><td colspan="6" style="text-align: center;">No hay registros para esta fecha</td></tr>`;
            pendingBody.innerHTML = noRecordsMsg;
            completedBody.innerHTML = noRecordsMsg;
            return;
        }
        
        // Procesar los documentos
        processedDocs.forEach(doc => {
            const record = { id: doc.id, ...doc.data() };
            const displayName = getDisplayName(record);
            
            if (filter && !displayName.toLowerCase().includes(filter.toLowerCase())) {
                return;
            }
    
            if (!record.exitTime) {
                addPendingRecord(record);
            } else {
                addCompletedRecord(record);
            }
        });

    } catch (error) {
        console.error("Error completo:", error);
        const errorMsg = `<tr><td colspan="6" style="text-align: center; color: red;">${error.message}</td></tr>`;
        pendingBody.innerHTML = errorMsg;
        completedBody.innerHTML = errorMsg;
    }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', checkAuth);