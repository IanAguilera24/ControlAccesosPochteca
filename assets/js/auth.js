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

// Funciones principales

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. Esperar inicialización de Firebase
        await waitForFirebase();

        // 2. Referencias a elementos del DOM
        const loginForm = document.getElementById('loginForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        // Renombramos la referencia al elemento DOM para evitar conflicto con la variable local de error en catch
        const errorMessageDisplay = document.getElementById('errorMessage');
        const loginButton = loginForm.querySelector('button[type="submit"]');

        // 3. Funciones auxiliares
        const showError = (message, duration = 5000) => {
            errorMessageDisplay.textContent = message;
            errorMessageDisplay.style.display = 'block';
            setTimeout(() => {
                errorMessageDisplay.style.display = 'none';
            }, duration);
        };

        const hideError = () => {
            errorMessageDisplay.textContent = '';
            errorMessageDisplay.style.display = 'none';
        };

        const redirectByRole = (role) => {
            
            const basePath = '../';

            const pages = {
                admin: 'administrador.html',
                guardia: 'guardia.html'
            };

            if (pages[role]) {
                window.location.href = pages[role]; // Redirige directamente al nombre del archivo
            } else {
                showError('Rol no configurado o no válido. Contacte al administrador.', 3000);
                auth.signOut();
            }
        };

        // 4. Función de login mejorada (con manejo de permisos)
        const handleLogin = async (email, password) => {
            loginButton.disabled = true;
            loginButton.textContent = 'Verificando...';
            hideError(); // Ocultar errores previos

            try {
                // 1. Autenticación con Firebase Auth
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 2. Consulta SEGURA para obtener el rol desde Firestore
                const userDoc = await db.collection('usuarios').doc(user.uid).get();

                if (!userDoc.exists) {
                    await auth.signOut();
                    throw new Error('No se encontró información de su usuario en la base de datos. Contacte al administrador.');
                }

                const userData = userDoc.data();
                const ALLOWED_ROLES = ['admin', 'guardia'];

                // 3. Verificación de rol
                if (!userData.rol || !ALLOWED_ROLES.includes(userData.rol)) {
                    await auth.signOut();
                    throw new Error('Su rol no es válido o no está asignado. Contacte al administrador.');
                }

                // 4. Redirección
                redirectByRole(userData.rol);

            } catch (error) {
                console.error('Error en login:', error);

                // Mensajes de error mejorados y más específicos
                let displayMessage = 'Error al iniciar sesión. Intente de nuevo.';
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        displayMessage = 'Correo o contraseña incorrectos.';
                        break;
                    case 'auth/invalid-email':
                        displayMessage = 'El formato del correo electrónico es inválido.';
                        break;
                    case 'auth/user-disabled':
                        displayMessage = 'Su cuenta ha sido deshabilitada. Contacte al administrador.';
                        break;
                    case 'auth/too-many-requests':
                        displayMessage = 'Demasiados intentos de inicio de sesión fallidos. Intente de nuevo más tarde.';
                        break;
                    // Errores personalizados que definimos arriba
                    case 'No se encontró información de su usuario en la base de datos. Contacte al administrador.':
                    case 'Su rol no es válido o no está asignado. Contacte al administrador.':
                        displayMessage = error.message;
                        break;
                    default:
                        // Si es un error personalizado de nuestra lógica, lo mostramos tal cual
                        if (error.message.includes('No se encontró información') || error.message.includes('Rol no válido')) {
                            displayMessage = error.message;
                        } else {
                            displayMessage = 'Error desconocido al iniciar sesión. Por favor, intente de nuevo.';
                        }
                        break;
                }

                showError(displayMessage);
                await auth.signOut(); // Asegurarse de que no haya sesión activa si hubo un error
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

            // Validación mejorada de campos vacíos
            if (!email) {
                showError('Ingrese su correo electrónico.');
                emailInput.focus();
                return;
            }

            if (!password) {
                showError('Ingrese su contraseña.');
                passwordInput.focus();
                return;
            }

            // Validación de longitud de contraseña (8 a 32 caracteres)
            if (password.length < 8 || password.length > 32) {
                showError('La contraseña debe tener entre 8 y 32 caracteres.');
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
        console.error('Error crítico en DOMContentLoaded:', error);
        alert('Error grave al cargar la aplicación. Por favor, recargue la página.');
    }
});