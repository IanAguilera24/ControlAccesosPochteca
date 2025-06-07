document.addEventListener('DOMContentLoaded', function() {
    // =============================================
    // FUNCIONALIDAD DE TOGGLE DE CONTRASEÑA
    // =============================================
    
    // Para la estructura actual del HTML - Seleccionamos el botón directamente
    const toggleButton = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    
    // También podemos adaptarlo para futuros campos de contraseña con data-attributes
    const toggleButtons = toggleButton ? [toggleButton] : [];
    
    // Permite manejar el campo de contraseña actual y futuras implementaciones
    toggleButtons.forEach(button => {
        try {
            // Para el HTML actual, usamos directamente el passwordInput ya obtenido
            // Si en el futuro se usan data-attributes, esto seguirá funcionando
            const targetId = button.getAttribute('data-target') || 'password';
            const input = targetId === 'password' ? passwordInput : document.getElementById(targetId);
            
            // Elementos de iconos SVG en el HTML actual
            const eyeOpen = button.querySelector('.eye-open');
            const eyeClosed = button.querySelector('.eye-closed');
            
            // Validar que todos los elementos existan
            if (!input || !eyeOpen || !eyeClosed) {
                console.error('Faltan elementos necesarios para el toggle de contraseña:', 
                    {input, eyeOpen, eyeClosed, button});
                return;
            }
            
            // Asegurarse de que el estado inicial sea consistente
            input.setAttribute('type', 'password');
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
            button.setAttribute('aria-label', 'Mostrar contraseña');
            
            // Agregar atributos de accesibilidad
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('type', 'button'); // Ya existe en tu HTML, pero nos aseguramos
            
            // Manejador de eventos con debounce para evitar clicks rápidos consecutivos
            let isEnabled = true;
            button.addEventListener('click', function(e) {
                // Prevenir comportamiento por defecto (importante)
                e.preventDefault();
                
                if (!isEnabled) return;
                
                // Deshabilitar brevemente para evitar spam de clicks
                isEnabled = false;
                setTimeout(() => { isEnabled = true; }, 200);
                
                // Comprobar si el elemento aún existe en el DOM
                if (!document.body.contains(input)) {
                    console.warn('El campo de contraseña ya no existe en el DOM');
                    return;
                }
                
                // Alternar el tipo de input
                const isPassword = input.getAttribute('type') === 'password';
                const newType = isPassword ? 'text' : 'password';
                input.setAttribute('type', newType);
                
                // Actualizar iconos SVG y atributos de accesibilidad
                eyeOpen.style.display = isPassword ? 'none' : 'block';
                eyeClosed.style.display = isPassword ? 'block' : 'none';
                
                // Actualizar atributos ARIA
                const newLabel = isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña';
                button.setAttribute('aria-label', newLabel);
                button.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
            });
            
            // Ocultar la contraseña al enviar el formulario
            const form = input.closest('form');
            if (form) {
                form.addEventListener('submit', function() {
                    input.setAttribute('type', 'password');
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                    button.setAttribute('aria-label', 'Mostrar contraseña');
                    button.setAttribute('aria-pressed', 'false');
                });
            }
            
        } catch (error) {
            console.error('Error en el toggle de contraseña:', error);
        }
    });
    
    // Implementación de cambio automático a modo password al perder el foco
    document.addEventListener('focusout', function(event) {
        // Comprobamos si es el campo de contraseña de nuestro login
        if (event.target.id === 'password' && event.target.getAttribute('type') === 'text') {
            const toggleButton = document.querySelector('.toggle-password');
            
            if (toggleButton) {
                // Restaura el tipo password y actualiza la UI
                event.target.setAttribute('type', 'password');
                
                const eyeOpen = toggleButton.querySelector('.eye-open');
                const eyeClosed = toggleButton.querySelector('.eye-closed');
                
                if (eyeOpen && eyeClosed) {
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                    toggleButton.setAttribute('aria-label', 'Mostrar contraseña');
                    toggleButton.setAttribute('aria-pressed', 'false');
                }
            }
        }
    }, true);
    
    // =============================================
    // FUNCIONALIDAD DE RECUPERACIÓN DE CONTRASEÑA
    // =============================================
    
    // Referencias a elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const backToLoginLink = document.getElementById('backToLoginLink');
    const resetEmailInput = document.getElementById('resetEmail');
    
    // Función para mostrar el formulario de recuperación
    function showResetForm() {
        loginForm.style.display = 'none';
        resetPasswordForm.style.display = 'block';
        resetEmailInput.focus();
    }
    
    // Función para mostrar el formulario de login
    function showLoginForm() {
        resetPasswordForm.style.display = 'none';
        loginForm.style.display = 'block';
        document.getElementById('email').focus();
    }
    
    // Event listeners para cambiar entre formularios
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        showResetForm();
    });
    
    backToLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        showLoginForm();
    });
    
    // Función simplificada para enviar correo de recuperación
    async function sendPasswordResetEmail(email) {
        try {
            // Enviar directamente el enlace de recuperación sin verificar primero
            await firebase.auth().sendPasswordResetEmail(email, {
                url: window.location.origin + '/login.html',
                handleCodeInApp: false
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error al enviar correo de recuperación:', error);
            return { success: false, error: error };
        }
    }
    
    // Manejador del formulario de recuperación
    resetPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const resetBtn = document.querySelector('.reset-btn');
        const originalBtnText = resetBtn.innerHTML;
        const email = resetEmailInput.value.trim();
        
        // Validación básica del email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Swal.fire({
                icon: 'error',
                title: 'Correo inválido',
                text: 'Por favor, ingresa un correo electrónico válido.'
            });
            return;
        }
        
        // Mostrar estado de carga
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<span class="loader"></span> Enviando...';
        
        try {
            const result = await sendPasswordResetEmail(email);
            
            if (result.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Correo enviado',
                    html: `Se ha enviado un enlace de recuperación a:<br><strong>${email}</strong><br><br>Revisa tu bandeja de entrada y carpeta de spam.<br><br><small>Si el correo no existe en nuestro sistema, no recibirás ningún mensaje.</small>`,
                    confirmButtonText: 'Entendido'
                });
                
                resetPasswordForm.reset();
                showLoginForm();
            } else {
                let errorMessage = 'Ocurrió un error al enviar el correo de recuperación.';
                
                switch (result.error.code) {
                    case 'auth/user-not-found':
                        // Firebase enviará el email exitosamente pero no llegará
                        // Mostrar mensaje de éxito por seguridad
                        await Swal.fire({
                            icon: 'info',
                            title: 'Correo procesado',
                            html: `Se ha procesado la solicitud para:<br><strong>${email}</strong><br><br>Si existe una cuenta con este correo, recibirás un enlace de recuperación.<br><br>Revisa tu bandeja de entrada y carpeta de spam.`,
                            confirmButtonText: 'Entendido'
                        });
                        resetPasswordForm.reset();
                        showLoginForm();
                        return;
                    case 'auth/invalid-email':
                        errorMessage = 'El correo electrónico no es válido.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Demasiados intentos. Espera un momento antes de intentar nuevamente.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
                        break;
                    default:
                        errorMessage = `Error: ${result.error.message || result.error.code}`;
                }
                
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errorMessage
                });
            }
        } catch (error) {
            console.error('Error inesperado:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error inesperado. Inténtalo nuevamente.'
            });
        } finally {
            resetBtn.disabled = false;
            resetBtn.innerHTML = originalBtnText;
        }
    });
    
    // Verificar integración con Firebase Auth
    if (typeof firebase !== 'undefined' && firebase.auth) {
        console.log('Firebase Auth detectado - Funcionalidades de autenticación habilitadas');
    }
});

// =============================================
// AUTENTICACIÓN Y REDIRECCIÓN POR ROLES
// =============================================

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // ============== [1] INICIO - Mostrar loader ==============
    const submitBtn = document.querySelector('.login-btn');
    const originalBtnText = submitBtn.innerHTML; // Guardar texto original
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Autenticando...';
    // =========================================================

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        Swal.fire({
            icon: 'error',
            title: 'Campos incompletos',
            text: 'Por favor ingresa correo y contraseña'
        });

        // ===== Restaurar botón si hay error =====
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        // ========================================
        return;
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            const userDoc = await firebase.firestore().collection('usuarios').doc(userCredential.user.uid).get();
            
            if (!userDoc.exists) {
                throw new Error('No tienes permisos asignados');
            }

            const userData = userDoc.data();
            
            if (userData.rol === 'admin') {
                window.location.href = 'administrador.html';
            } else if (userData.rol === 'guardia') {
                window.location.href = 'guardia.html';
            } else {
                throw new Error('Rol no reconocido');
            }
        })
        .catch((error) => {
            let errorMessage = 'Error al iniciar sesión';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuario no registrado';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Contraseña incorrecta';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Demasiados intentos. Cuenta temporalmente bloqueada';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Correo electrónico inválido';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Esta cuenta ha sido deshabilitada';
                    break;
            }

            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMessage || error.message
            });
        })
        // ============== [2] FINAL - Restaurar botón ==============
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        });
        // =========================================================
});