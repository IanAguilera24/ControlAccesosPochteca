// Función para mostrar/ocultar contraseña
document.addEventListener('DOMContentLoaded', function() {
    const togglePassword = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    const eyeOpen = document.querySelector('.eye-open');
    const eyeClosed = document.querySelector('.eye-closed');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Cambiar iconos
            if (type === 'password') {
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
                this.setAttribute('aria-label', 'Mostrar contraseña');
            } else {
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
                this.setAttribute('aria-label', 'Ocultar contraseña');
            }
        });
    }
});