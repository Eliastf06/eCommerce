// js/auth.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Tus credenciales de Supabase (las de tu proyecto principal: TRJBRDMWUPSBBNGJVPX)
const SUPABASE_URL = 'https://trjbrdmwupsbbngjvpux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyamJyZG13dXBzYmJuZ2p2cHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNjkyOTgsImV4cCI6MjA2NzY0NTI5OH0.ZsAqAXMQRRP2WjeZN0dw_CR6kZPHyXgdl6-oyg-uuVY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referencia al elemento de mensaje global (busca cualquiera de los IDs posibles)
const appMessageElement = document.getElementById('message-container') || document.getElementById('product-upload-message') || document.getElementById('app-message');

/**
 * Muestra un mensaje en el contenedor de mensajes de la página.
 * @param {string} message - El mensaje a mostrar.
 * @param {'success'|'error'|'info'|'black'} type - El tipo de mensaje para aplicar estilos.
 */
export function showMessage(message, type = 'info') {
    if (!appMessageElement) {
        console.warn('Elemento de mensaje no encontrado. Mensaje:', message);
        if (type === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }
        return;
    }

    appMessageElement.textContent = message;
    appMessageElement.classList.remove('success', 'error', 'info', 'black'); // Limpiar clases existentes
    
    if (type === 'success') {
        appMessageElement.style.color = 'green';
    } else if (type === 'error') {
        appMessageElement.style.color = 'red';
    } else {
        appMessageElement.style.color = 'black'; // O el color por defecto que prefieras
    }

    appMessageElement.style.display = 'block';

    setTimeout(() => {
        appMessageElement.style.display = 'none';
        appMessageElement.textContent = '';
        appMessageElement.style.color = ''; // Limpiar color
    }, 5000);
}

/**
 * Actualiza los elementos de la UI relacionados con la autenticación (links de login/logout, info de usuario, etc.).
 * Esta función debe ser exportada para ser usada en otras páginas.
 */
export async function updateAuthUI() {
    const { data: { user } } = await supabase.auth.getUser();
    const userInfoLink = document.getElementById('user-info-link');
    const loginLink = document.getElementById('login-link');
    const logoutButton = document.getElementById('logout-button');
    const addProductLink = document.getElementById('add-product-link');
    const adminLogoutButton = document.getElementById('admin-logout-button');

    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'inline-block';
        if (userInfoLink) userInfoLink.style.display = 'inline-block';
        if (adminLogoutButton) adminLogoutButton.style.display = 'inline-block';

        let username = user.email; // Fallback al email
        let isAdmin = false;

        try {
            // Intentamos obtener el username y is_admin de nuestra tabla 'users'
            const { data: userData, error: userError } = await supabase
                .from('users') // Tu tabla 'users'
                .select('username, is_admin')
                .eq('id', user.id)
                .single();

            if (userError && userError.code !== 'PGRST116') { // PGRST116 = no rows found
                console.warn('Error al obtener perfil del usuario desde la tabla users:', userError.message);
                // Si no se encuentra en nuestra tabla, intentar de user_metadata
                if (user.user_metadata && user.user_metadata.username) {
                    username = user.user_metadata.username;
                }
            } else if (userData) {
                if (userData.username) {
                    username = userData.username;
                }
                if (typeof userData.is_admin === 'boolean') {
                    isAdmin = userData.is_admin;
                }
            }
        } catch (userProfileErr) {
            console.warn('Error en la consulta de usuario para updateAuthUI:', userProfileErr);
            // Fallback a user_metadata si hay un error en la consulta
            if (user.user_metadata && user.user_metadata.username) {
                username = user.user_metadata.username;
            }
        }

        if (userInfoLink) userInfoLink.textContent = `Hola, ${username}`;

        if (addProductLink) {
            if (isAdmin) {
                addProductLink.style.display = 'inline-block';
            } else {
                addProductLink.style.display = 'none';
            }
        }

    } else {
        if (loginLink) loginLink.style.display = 'inline-block';
        if (logoutButton) logoutButton.style.display = 'none';
        if (userInfoLink) userInfoLink.style.display = 'none';
        if (addProductLink) addProductLink.style.display = 'none';
        if (adminLogoutButton) adminLogoutButton.style.display = 'none';
    }
}


// ======================================
// Lógica ESPECÍFICA para login.html
// ======================================
if (window.location.pathname.endsWith('/login.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const loginFormContainer = document.getElementById('login-form-container');
        const registerFormContainer = document.getElementById('register-form-container');
        const showRegisterLink = document.getElementById('show-register');
        const showLoginLink = document.getElementById('show-login');

        const loginForm = document.getElementById('login-form');
        const loginEmailInput = document.getElementById('login-email');
        const loginPasswordInput = document.getElementById('login-password');

        const registerForm = document.getElementById('register-form');
        const registerUsernameInput = document.getElementById('register-username');
        const registerEmailInput = document.getElementById('register-email');
        const registerPasswordInput = document.getElementById('register-password');
        const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
        const forgotPasswordLink = document.getElementById('olvide-contraseña');

        // Lógica para mostrar/ocultar formularios
        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (loginFormContainer) loginFormContainer.classList.add('hidden');
                if (registerFormContainer) registerFormContainer.classList.remove('hidden');
                showMessage('', 'info'); // Limpiar mensaje
            });
        }

        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (registerFormContainer) registerFormContainer.classList.add('hidden');
                if (loginFormContainer) loginFormContainer.classList.remove('hidden');
                showMessage('', 'info'); // Limpiar mensaje
            });
        }

        // Manejo del Registro de Usuarios (SIMPLIFICADO PARA DEPURACIÓN)
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const username = registerUsernameInput ? registerUsernameInput.value.trim() : '';
                const email = registerEmailInput ? registerEmailInput.value.trim() : '';
                const password = registerPasswordInput ? registerPasswordInput.value.trim() : '';
                const confirmPassword = registerConfirmPasswordInput ? registerConfirmPasswordInput.value.trim() : '';

                if (password !== confirmPassword) {
                    showMessage('Las contraseñas no coinciden.', 'error');
                    return;
                }
                if (!username || !email || !password) {
                    showMessage('Por favor, completa todos los campos.', 'error');
                    return;
                }

                showMessage('Registrando usuario...', 'black');

                try {
                    // La llamada de registro es como en scrip-log.js, sin emailRedirectTo
                    const { data, error } = await supabase.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: {
                                username: username // Guardar username en user_metadata
                            }
                        }
                    });

                    if (error) {
                        console.error('Error al registrar:', error);
                        showMessage(`Error al registrar: ${error.message}`, 'error');
                        return;
                    }

                    if (data.user) {
                        // ==============================================================
                        // *** DESCOMENTADO ***
                        // Insertar en tu tabla 'users' después de que Supabase haya creado el usuario Auth
                        // Esto es crucial para guardar el username y el estado is_admin
                        // ==============================================================
                        const { error: insertError } = await supabase
                            .from('users')
                            .insert({ id: data.user.id, username: username, email: email, is_admin: false });

                        if (insertError) {
                            console.error('Error al guardar el perfil de usuario en la tabla users:', insertError);
                            showMessage('¡Registro exitoso en Supabase! PERO pero debes confirmar el correo en tu email', 'error');
                            // Considera si quieres redirigir o no si esta inserción falla
                        } else {
                            showMessage(`¡Registro exitoso! Por favor, revisa tu email (${email}) para confirmar tu cuenta.`, 'success');
                        }

                        setTimeout(() => {
                            if (showLoginLink) showLoginLink.click();
                            if (registerForm) registerForm.reset();
                        }, 5000);
                    } else {
                        // Esto ocurre si el email ya existe o requiere confirmación sin que 'data.user' esté presente de inmediato.
                        showMessage('Registro completado, pero se requiere verificación por email. Si ya tienes una cuenta, intenta iniciar sesión.', 'success');
                        setTimeout(() => {
                            if (showLoginLink) showLoginLink.click();
                            if (registerForm) registerForm.reset();
                        }, 5000);
                    }

                } catch (err) {
                    console.error('Error inesperado al registrar:', err);
                    showMessage('Ocurrió un error inesperado durante el registro.', 'error');
                }
            });
        }

        // Manejo del Inicio de Sesión
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = loginEmailInput ? loginEmailInput.value.trim() : '';
                const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';

                if (!email || !password) {
                    showMessage('Por favor, ingresa tu email y contraseña.', 'error');
                    return;
                }

                showMessage('Iniciando sesión...', 'black');

                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: email,
                        password: password,
                    });

                    if (error) {
                        console.error('Error al iniciar sesión:', error);
                        if (error.message.includes('Invalid login credentials')) {
                            showMessage('Credenciales incorrectas. Verifica tu email y contraseña.', 'error');
                        } else if (error.message.includes('Email not confirmed')) {
                            showMessage('Tu email no ha sido confirmado. Revisa tu bandeja de entrada o spam.', 'error');
                        } else {
                            showMessage(`Error al iniciar sesión: ${error.message}`, 'error');
                        }
                        return;
                    }

                    if (data.user) {
                        let username = data.user.email; // Fallback

                        // Intentar obtener username de user_metadata (como en scrip-log.js)
                        if (data.user.user_metadata && data.user.user_metadata.username) {
                            username = data.user.user_metadata.username;
                        }
                        
                        // Si queremos usar el de nuestra tabla 'users' para usuarios existentes:
                        // (esto no fallaría si el usuario ya existe en nuestra tabla)
                        try {
                            const { data: userData, error: userError } = await supabase
                                .from('users')
                                .select('username')
                                .eq('id', data.user.id)
                                .single();
                            
                            if (!userError && userData && userData.username) {
                                username = userData.username;
                            }
                        } catch (profileErr) {
                            console.warn('Error en la consulta de perfil de usuario para login:', profileErr);
                        }


                        showMessage(`¡Inicio de sesión exitoso! Bienvenido, ${username}!`, 'success');
                        console.log('Usuario logueado:', data.user);
                        window.location.href = 'index.html';
                        if (loginForm) loginForm.reset();
                    } else {
                        showMessage('No se pudo iniciar sesión. Verifica tus credenciales.', 'error');
                    }

                } catch (err) {
                    console.error('Error inesperado al iniciar sesión:', err);
                    showMessage('Ocurrió un error inesperado durante el inicio de sesión.', 'error');
                }
            });
        }

        // Manejo de "Olvidé mi contraseña"
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = prompt("Por favor, ingresa tu email para restablecer la contraseña:");
                if (!email) {
                    showMessage("Restablecimiento de contraseña cancelado.", "error");
                    return;
                }

                showMessage("Enviando enlace de restablecimiento...", 'black');
                try {
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + '/update-password.html'
                    });
                    if (error) {
                        console.error("Error al enviar restablecimiento:", error);
                        showMessage(`Error al enviar restablecimiento: ${error.message}`, 'error');
                    } else {
                        showMessage("Se ha enviado un enlace para restablecer tu contraseña a tu email. Revisa tu bandeja de entrada y la carpeta de spam.", 'success');
                    }
                } catch (err) {
                    console.error("Error inesperado al restablecer:", err);
                    showMessage('Ocurrió un error inesperado al restablecer la contraseña.', 'error');
                }
            });
        }

        // Comprobar estado de autenticación al cargar la página
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    console.log("Usuario ya autenticado en login.html:", user);
                    window.location.href = 'index.html'; // Redirigir si ya está logueado
                }
            } catch (error) {
                console.error("Error al obtener el estado de autenticación en login.html:", error);
            }
        })();
    });
}


// Lógica para update-password.html
if (window.location.pathname.endsWith('/update-password.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const updatePasswordForm = document.getElementById('update-password-form');
        const newPasswordInput = document.getElementById('new-password');
        const confirmNewPasswordInput = document.getElementById('confirm-new-password');

        if (updatePasswordForm) {
            updatePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const newPassword = newPasswordInput ? newPasswordInput.value.trim() : '';
                const confirmNewPassword = confirmNewPasswordInput ? confirmNewPasswordInput.value.trim() : '';

                if (newPassword !== confirmNewPassword) {
                    showMessage('Las contraseñas no coinciden.', 'error');
                    return;
                }

                if (!newPassword) {
                    showMessage('Por favor, ingresa una nueva contraseña.', 'error');
                    return;
                }

                showMessage('Actualizando contraseña...', 'black');

                try {
                    const { error } = await supabase.auth.updateUser({
                        password: newPassword
                    });

                    if (error) {
                        console.error('Error al actualizar contraseña:', error);
                        showMessage(`Error al actualizar contraseña: ${error.message}`, 'error');
                    } else {
                        showMessage('Contraseña actualizada exitosamente. Redirigiendo a la página de inicio de sesión...', 'success');
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 3000);
                    }
                } catch (err) {
                    console.error('Error inesperado al actualizar contraseña:', err);
                    showMessage('Ocurrió un error inesperado al actualizar la contraseña.', 'error');
                }
            });
        }

        (async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                showMessage(`Error al obtener sesión para restablecimiento: ${error.message}`, 'error');
                return;
            }
            if (session) {
                console.log('Sesión activa para restablecimiento de contraseña:', session);
            } else {
                showMessage('Enlace de restablecimiento de contraseña inválido o expirado. Por favor, solicita uno nuevo.', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 5000);
            }
        })();
    });
}

// ======================================
// Lógica compartida para verificación de autenticación (logout, etc.)
// Aplica a index.html, product-detail.html y otras páginas que no sean login/update-password
// ======================================
document.addEventListener('DOMContentLoaded', async () => {
    // Si no estamos en login.html o update-password.html
    if (!window.location.pathname.endsWith('/login.html') && !window.location.pathname.endsWith('/update-password.html')) {
        await updateAuthUI(); // Llamar para configurar el estado inicial de los enlaces de autenticación

        const logoutButton = document.getElementById('logout-button');
        const adminLogoutButton = document.getElementById('admin-logout-button');

        if (logoutButton) {
            logoutButton.addEventListener('click', async (e) => {
                e.preventDefault();
                const { error } = await supabase.auth.signOut();
                if (!error) {
                    showMessage('Sesión cerrada correctamente.', 'success');
                    window.location.href = 'login.html';
                } else {
                    showMessage('Error al cerrar sesión.', 'error');
                }
            });
        }
        if (adminLogoutButton) {
            adminLogoutButton.addEventListener('click', async (e) => {
                e.preventDefault();
                const { error } = await supabase.auth.signOut();
                if (!error) {
                    showMessage('Sesión cerrada correctamente.', 'success');
                    window.location.href = 'login.html';
                } else {
                    showMessage('Error al cerrar sesión.', 'error');
                }
            });
        }
    }
});

// Listener para el evento onAuthStateChange de Supabase (ejecutar la actualización de la UI cuando el estado cambia)
supabase.auth.onAuthStateChange((event, session) => {
    if (!window.location.pathname.endsWith('/login.html') && !window.location.pathname.endsWith('/update-password.html')) {
        console.log('Estado de autenticación cambiado:', event, session);
        updateAuthUI();
    }
});