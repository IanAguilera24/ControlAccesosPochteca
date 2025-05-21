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
let currentPendingPage = 1;
let currentCompletedPage = 1;
const recordsPerPage = 6;
let allPendingRecords = [];
let allCompletedRecords = [];

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

// Función para mostrar notificaciones toast
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Íconos para cada tipo (puedes usar Font Awesome o SVG)
    const icons = {
        error: '❌',
        success: '✅',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Eliminar el toast después de la animación
    setTimeout(() => {
        toast.remove();
    }, 3000);
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

async function registerEntry() {
    try {
        // Validar formulario
        const selectedType = Array.from(visitorType).find(radio => radio.checked).value;
        const vehicleType = document.getElementById('vehicleType').value;
        const licensePlate = document.getElementById('licensePlate').value;
        
        if (!sucursal.value) {
            showToast('Por favor, seleccione una sucursal.', 'warning');
            return;
        }
        
        let visitorData = {
            type: selectedType,
            sucursal: sucursal.value,
            entryTime: firebase.firestore.Timestamp.now(),
            observations: observations.value,
            vehicleType,
            licensePlate
        };
        
        if (selectedType === 'Cliente') {
            const companyName = document.getElementById('companyName').value;
            const clientPersonName = document.getElementById('clientPersonName').value;
            const product = document.getElementById('product').value;
            
            if (!clientPersonName) {
                showToast('Por favor, ingrese el nombre de la persona.', 'warning');
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
                showToast('Por favor, complete todos los campos obligatorios.', 'warning');
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
        
        showToast('Entrada registrada con éxito.', 'success');
    } catch (error) {
        console.error('Error al registrar entrada:', error);
        showToast(`Error al registrar entrada: ${error.message}`, 'error');
    }
}

// Registrar salida
// Registrar salida (versión con notificaciones toast)
async function registerExit(recordId) {
    try {
        await db.collection('registros_visitantes').doc(recordId).update({
            exitTime: firebase.firestore.Timestamp.now()
        });
        
        displayRecords(searchInput.value);
        showToast('Salida registrada con éxito.', 'success');
    } catch (error) {
        console.error('Error al registrar salida:', error);
        showToast(`Error al registrar salida: ${error.message}`, 'error');
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
    
    // Actualizar visibilidad de la paginación
    updatePaginationVisibility();
}

function createPaginationControls(totalPages, currentPage, type) {
    const controlsContainer = document.getElementById(`${type}PaginationControls`);
    controlsContainer.innerHTML = '';
    
    // Botón Anterior
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '«';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = currentPage === 1;
    if (currentPage === 1) prevBtn.classList.add('disabled');
    prevBtn.onclick = () => changePage(currentPage - 1, type);
    controlsContainer.appendChild(prevBtn);
    
    // Páginas
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = 'pagination-btn';
        if (i === currentPage) pageBtn.classList.add('active');
        pageBtn.onclick = () => changePage(i, type);
        controlsContainer.appendChild(pageBtn);
    }
    
    // Botón Siguiente
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '»';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = currentPage === totalPages;
    if (currentPage === totalPages) nextBtn.classList.add('disabled');
    nextBtn.onclick = () => changePage(currentPage + 1, type);
    controlsContainer.appendChild(nextBtn);
    
    // Actualizar información de paginación
    const infoContainer = document.getElementById(`${type}PaginationInfo`);
    infoContainer.textContent = `Página ${currentPage} de ${totalPages} - ${type === 'pending' ? allPendingRecords.length : allCompletedRecords.length} registros`;
}

function displayPendingRecords() {
    pendingBody.innerHTML = '';
    
    const startIndex = (currentPendingPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, allPendingRecords.length);
    const recordsToShow = allPendingRecords.slice(startIndex, endIndex);
    
    if (recordsToShow.length === 0) {
        pendingBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay registros pendientes</td></tr>`;
    } else {
        recordsToShow.forEach(record => {
            addPendingRecord(record);
        });
    }
    
    const totalPages = Math.ceil(allPendingRecords.length / recordsPerPage);
    createPaginationControls(totalPages, currentPendingPage, 'pending');
}

function displayCompletedRecords() {
    completedBody.innerHTML = '';
    
    const startIndex = (currentCompletedPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, allCompletedRecords.length);
    const recordsToShow = allCompletedRecords.slice(startIndex, endIndex);
    
    if (recordsToShow.length === 0) {
        completedBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay registros completados</td></tr>`;
    } else {
        recordsToShow.forEach(record => {
            addCompletedRecord(record);
        });
    }
    
    const totalPages = Math.ceil(allCompletedRecords.length / recordsPerPage);
    createPaginationControls(totalPages, currentCompletedPage, 'completed');
}

function changePage(page, type) {
    if (type === 'pending') {
        currentPendingPage = page;
        displayPendingRecords();
    } else {
        currentCompletedPage = page;
        displayCompletedRecords();
    }
}

// Proteccion contra XSS
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input; // Esto automáticamente escapa HTML
    return div.innerHTML;
}

// Mostrar detalles de un registro (versión mejorada con modal)
async function viewDetails(recordId) {
    try {
        const doc = await db.collection('registros_visitantes').doc(recordId).get();
        
        if (!doc.exists) {
            alert('El registro ya no existe.');
            return;
        }
        
        const record = doc.data();
        let detailsHTML = '';
        
        // Datos comunes
        detailsHTML += `<p><strong>Tipo:</strong> ${sanitizeInput(record.type)}</p>`;
        detailsHTML += `<p><strong>Sucursal:</strong> ${sanitizeInput(record.sucursal)}</p>`;
        detailsHTML += `<p><strong>Entrada:</strong> ${sanitizeInput(formatTimestamp(record.entryTime))}</p>`;
        
        if (record.exitTime) {
            detailsHTML += `<p><strong>Salida:</strong> ${sanitizeInput(formatTimestamp(record.exitTime))}</p>`;
        }
        
        // Datos específicos según tipo
        if (record.type === 'Cliente') {
            if (record.companyName) detailsHTML += `<p><strong>Razón Social:</strong> ${sanitizeInput(record.companyName)}</p>`;
            detailsHTML += `<p><strong>Nombre:</strong> ${sanitizeInput(record.clientPersonName)}</p>`;
            if (record.product) detailsHTML += `<p><strong>Producto:</strong> ${sanitizeInput(record.product)}</p>`;
        } else {
            detailsHTML += `<p><strong>Nombre:</strong> ${sanitizeInput(record.visitorName)}</p>`;
            detailsHTML += `<p><strong>Motivo:</strong> ${sanitizeInput(record.visitPurpose)}</p>`;
            detailsHTML += `<p><strong>Persona a visitar:</strong> ${sanitizeInput(record.personToVisit)}</p>`;
            if (record.area) detailsHTML += `<p><strong>Área:</strong> ${sanitizeInput(record.area)}</p>`;
        }

        if (record.vehicleType) detailsHTML += `<p><strong>Tipo de vehículo:</strong> ${sanitizeInput(record.vehicleType)}</p>`;
        if (record.licensePlate) detailsHTML += `<p><strong>Placa:</strong> ${sanitizeInput(record.licensePlate)}</p>`;
        
        if (record.observations) {
            detailsHTML += `<p><strong>Observaciones:</strong><br>${sanitizeInput(record.observations)}</p>`;
        }
        
        // Mostrar en modal
        const modal = document.getElementById('detailsModal');
        const modalContent = document.getElementById('modalDetailsContent');
        modalContent.innerHTML = detailsHTML;
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error al obtener detalles:', error);
        alert('Error al obtener detalles: ' + error.message);
    }
}

// Cerrar modal al hacer clic en la "X"
document.querySelector('.close-modal').addEventListener('click', function() {
    document.getElementById('detailsModal').style.display = 'none';
});

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener('click', function(event) {
    const modal = document.getElementById('detailsModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// Exportar registros a Excel (versión mejorada)
async function exportToExcel() {
    try {
        showToast('Preparando exportación...', 'info');
        
        // Obtener todos los registros de Firestore
        const querySnapshot = await db.collection("registros_visitantes")
            .orderBy("entryTime", "desc")
            .get();

        if (querySnapshot.empty) {
            showToast('No hay registros para exportar', 'warning');
            return;
        }

        // Formatear datos para Excel
        const allData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                'Tipo': data.type,
                'Nombre/Razón Social': data.type === 'Cliente' 
                    ? (data.companyName ? `${data.companyName} - ${data.clientPersonName}` : data.clientPersonName)
                    : data.visitorName,
                'Sucursal': data.sucursal,
                'Fecha/Hora Entrada': formatTimestamp(data.entryTime),
                'Fecha/Hora Salida': data.exitTime ? formatTimestamp(data.exitTime) : 'PENDIENTE',
                'Motivo': data.visitPurpose || 'N/A',
                'Persona a visitar': data.personToVisit || 'N/A',
                'Área': data.area || 'N/A',
                'Producto': data.product || 'N/A',
                'Tipo de vehículo': data.vehicleType || 'N/A',
                'Placa': data.licensePlate || 'N/A',
                'Observaciones': data.observations || 'N/A'
            };
        });

        // Crear libro de Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(allData);
        
        // Añadir hoja al libro
        XLSX.utils.book_append_sheet(workbook, worksheet, 'RegistrosCompletos');
        
        // Generar nombre de archivo
        const today = new Date();
        const formattedDate = today.toLocaleDateString('es-MX').replace(/\//g, '-');
        
        // Exportar
        XLSX.writeFile(workbook, `RegistrosCompletos_${formattedDate}.xlsx`);
        showToast('Exportación completada con éxito', 'success');
        
    } catch (error) {
        console.error('Error al exportar:', error);
        showToast(`Error al exportar: ${error.message}`, 'error');
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

async function displayRecords(filter = '') {
    const dateFilter = document.getElementById('dateFilter').value;
    const branchFilter = document.getElementById('branchFilter')?.value || '';
    
    // Resetear a la primera página cuando se aplica un nuevo filtro
    currentPendingPage = 1;
    currentCompletedPage = 1;
    
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
        
        // Procesar los documentos
        allPendingRecords = [];
        allCompletedRecords = [];
        
        processedDocs.forEach(doc => {
            const record = { id: doc.id, ...doc.data() };
            const displayName = getDisplayName(record);
            
            if (filter && !displayName.toLowerCase().includes(filter.toLowerCase())) {
                return;
            }
    
            if (!record.exitTime) {
                allPendingRecords.push(record);
            } else {
                allCompletedRecords.push(record);
            }
        });

        // Mostrar los registros con paginación
        displayPendingRecords();
        displayCompletedRecords();
        
        // Mostrar/ocultar controles según la pestaña activa
        updatePaginationVisibility();

    } catch (error) {
        console.error("Error completo:", error);
        const errorMsg = `<tr><td colspan="6" style="text-align: center; color: red;">${error.message}</td></tr>`;
        pendingBody.innerHTML = errorMsg;
        completedBody.innerHTML = errorMsg;
    }
}

function updatePaginationVisibility() {
    const activeTab = document.querySelector('.tab-button.active').textContent.trim();
    
    if (activeTab.includes("sin salida")) {
        document.getElementById('pendingPaginationInfo').style.display = 'block';
        document.getElementById('pendingPaginationControls').style.display = 'flex';
        document.getElementById('completedPaginationInfo').style.display = 'none';
        document.getElementById('completedPaginationControls').style.display = 'none';
    } else {
        document.getElementById('pendingPaginationInfo').style.display = 'none';
        document.getElementById('pendingPaginationControls').style.display = 'none';
        document.getElementById('completedPaginationInfo').style.display = 'block';
        document.getElementById('completedPaginationControls').style.display = 'flex';
    }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', checkAuth);