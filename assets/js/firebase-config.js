try {
    if (!firebase.apps.length) {  // Evita reinicializar Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyAc8JSWUiKKkZRHvF76l1ko2QMFho3WJ58",
            authDomain: "sistemaaccesopochteca.firebaseapp.com",
            projectId: "sistemaaccesopochteca",
            storageBucket: "sistemaaccesopochteca.appspot.com",
            messagingSenderId: "564799602031",
            appId: "1:564799602031:web:73e80b856c791dbeb47c9a"
        };

        // Inicializa Firebase
        const app = firebase.initializeApp(firebaseConfig);

        // Exporta los servicios necesarios
        window.auth = firebase.auth(app);
        window.db = firebase.firestore(app);
        window.Timestamp = firebase.firestore.Timestamp;

        console.log("Firebase configurado correctamente");
    }
} catch (error) {
    console.error("Error al inicializar Firebase:", error);
    alert("Error crítico: No se pudo conectar a Firebase. Recargue la página.");
}