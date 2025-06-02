document.addEventListener('DOMContentLoaded', function() {
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
    
    // Verificar integración con Firebase Auth
    if (typeof firebase !== 'undefined' && firebase.auth) {
        console.log('Firebase Auth detectado - Toggle de contraseña funcionando en conjunto con Firebase');
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