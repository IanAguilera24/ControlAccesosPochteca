// auth.js - Versión final optimizada

// =============================================
// Configuración inicial
// =============================================

// Función para esperar que Firebase esté listo
// auth.js - Versión tradicional
function waitForFirebase() {
    return new Promise((resolve) => {
        const maxAttempts = 50;
        let attempts = 0;
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            // Verificación más robusta
            if (window.firebase && window.auth && window.db) {
                console.log('Firebase cargado correctamente');
                clearInterval(checkInterval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('Firebase no se cargó. Verifica:');
                console.log('Firebase:', window.firebase);
                console.log('Auth:', window.auth);
                console.log('Firestore:', window.db);
                alert('Error: Firebase no se inicializó. Recargue la página.');
            }
        }, 100);
    });
}
  
  // =============================================
  // Funciones principales
  // =============================================

  document.addEventListener('DOMContentLoaded', async function() {
    try {
      // 1. Esperar inicialización de Firebase
      await waitForFirebase();
  
      // 2. Referencias a elementos del DOM
      const loginForm = document.getElementById('loginForm');
      const emailInput = document.getElementById('email');
      const passwordInput = document.getElementById('password');
      const errorMessage = document.getElementById('errorMessage');
      const loginButton = loginForm.querySelector('button[type="submit"]');
  
      // 3. Funciones auxiliares
      const showError = (message, duration = 5000) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
          errorMessage.style.display = 'none';
        }, duration);
      };
  
      const redirectByRole = (role) => {
        const basePath = window.location.pathname.includes('assets/html') ? '' : 'assets/html/';
        const pages = {
          admin: 'administrador.html',
          guardia: 'guardia.html'
        };
        
        if (pages[role]) {
          window.location.href = basePath + pages[role];
        } else {
          showError('Rol no configurado', 3000);
          auth.signOut();
        }
      };
  
      // 4. Función de login mejorada (con manejo de permisos)
      const handleLogin = async (email, password) => {
        try {
          loginButton.disabled = true;
          loginButton.textContent = 'Verificando...';
          
          // 1. Autenticación con Firebase Auth
          const userCredential = await auth.signInWithEmailAndPassword(email, password);
          const user = userCredential.user;
      
          // 2. Consulta SEGURA para obtener el rol
          const userDoc = await db.collection('usuarios').doc(user.uid).get();
      
          if (!userDoc.exists) {
            await auth.signOut();
            throw new Error('No tienes permisos para acceder');
          }
      
          const userData = userDoc.data();
          const ALLOWED_ROLES = ['admin', 'guardia'];
          
          // 3. Verificación de rol
          if (!userData.rol || !ALLOWED_ROLES.includes(userData.rol)) {
            await auth.signOut();
            throw new Error('Rol no válido o no asignado');
          }
      
          // 4. Redirección
          redirectByRole(userData.rol);
      
        } catch (error) {
          console.error('Error en login:', error);
          
          // Mensajes de error mejorados
          const errorMessage = {
            'permission-denied': 'No tienes permisos para acceder al sistema',
            'missing-permissions': 'Falta configuración de permisos'
          }[error.code] || error.message || 'Error al iniciar sesión';
          
          showError(errorMessage);
          await auth.signOut();
        } finally {
          loginButton.textContent = 'Iniciar Sesión';
          loginButton.disabled = false;
        }
      };
  
      // 5. Event Listeners
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
  
        // Validación mejorada
        if (!email) {
          showError('Ingrese su correo electrónico');
          emailInput.focus();
          return;
        }
  
        if (!password) {
          showError('Ingrese su contraseña');
          passwordInput.focus();
          return;
        }
  
        await handleLogin(email, password);
      });
  
      // Mejoras de UX
      emailInput.focus();
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginForm.requestSubmit();
      });
  
    } catch (error) {
      console.error('Error crítico:', error);
      alert('Error al cargar el sistema. Recargue la página.');
    }
  });