// js/add-product.js

import { supabase, showMessage, updateAuthUI } from './auth.js'; // Importamos supabase, showMessage Y updateAuthUI

document.addEventListener('DOMContentLoaded', async () => {
    // Es buena práctica llamar a updateAuthUI también en esta página
    // para asegurar que los elementos de UI (como el enlace de admin en el header) se muestren correctamente.
    await updateAuthUI();

    const addProductForm = document.getElementById('add-product-form');
    const productNameInput = document.getElementById('product-name');
    const productDescriptionInput = document.getElementById('product-description');
    const productPriceInput = document.getElementById('product-price');
    const productStockInput = document.getElementById('product-stock');
    const productImageInput = document.getElementById('product-image');
    const fileNameDisplay = document.getElementById('file-name-display');
    const imagePreview = document.getElementById('image-preview');

    // Event listener para la selección de archivo de imagen
    productImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            fileNameDisplay.textContent = 'Ningún archivo seleccionado';
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
        }
    });

    // Función para subir una imagen a Supabase Storage
    async function uploadImage(file) {
        if (!file) return null;

        const sanitizedFileName = file.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9.-]/g, "_");

        const fileName = `${Date.now()}-${sanitizedFileName}`;
        const filePath = `product_images/${fileName}`; // Directorio específico para imágenes de productos

        try {
            const { data, error } = await supabase.storage
                .from('product-images-bucket') // Usa el bucket que creaste para productos
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            const { data: publicUrlData } = supabase.storage
                .from('product-images-bucket')
                .getPublicUrl(filePath);

            if (publicUrlData && publicUrlData.publicUrl) {
                return publicUrlData.publicUrl;
            } else {
                throw new Error("No se pudo obtener la URL pública de la imagen.");
            }

        } catch (error) {
            console.error('Error al subir imagen a Supabase Storage:', error);
            showMessage(`Error al subir la imagen: ${error.message}`, 'error');
            return null;
        }
    }

    // Event listener para el envío del formulario
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Verificar si el usuario está logueado y es administrador
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            showMessage('Debes iniciar sesión para agregar productos.', 'error');
            // Opcional: Redirigir a la página de login si lo consideras necesario.
            // window.location.href = 'login.html';
            return;
        }

        // Obtener el estado de is_admin del usuario actual
        const { data: userData, error: userError } = await supabase
            .from('users') // Asegúrate de que 'users' es el nombre correcto de tu tabla de perfiles
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (userError || !userData || !userData.is_admin) {
            console.error('Error al verificar permisos de administrador:', userError?.message || 'No se pudo obtener el estado de administrador.');
            showMessage('No tienes permisos para agregar productos. Solo los administradores pueden hacerlo.', 'error');
            return; // Detener la ejecución si no es admin
        }

        // Si llegamos aquí, el usuario es un administrador. Procede con la carga del producto.
        const name = productNameInput.value.trim();
        const description = productDescriptionInput.value.trim();
        const price = parseFloat(productPriceInput.value);
        const stock = parseInt(productStockInput.value);
        const imageFile = productImageInput.files[0];

        if (!name || !description || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0 || !imageFile) {
            showMessage('Por favor, completa todos los campos correctamente (precio > 0, stock >= 0).', 'error');
            return;
        }

        showMessage('Subiendo producto...', 'black');

        let imageUrl = null;
        if (imageFile) {
            imageUrl = await uploadImage(imageFile);
            if (!imageUrl) {
                return; // Detener si la carga de la imagen falla
            }
        }

        try {
            const { data, error } = await supabase
                .from('products') // Insertar en la tabla 'products' (asegúrate de que este sea el nombre correcto de tu tabla de productos)
                .insert([
                    {
                        name: name,
                        description: description,
                        price: price,
                        stock: stock,
                        image_url: imageUrl || null,
                    }
                ]);

            if (error) {
                console.error('Error al insertar producto en Supabase:', error);
                showMessage(`Error al subir el producto: ${error.message}`, 'error');
                // Si la inserción falla, intentar eliminar la imagen subida para limpiar
                if (imageUrl) {
                    // La URL pública incluye el nombre del bucket, necesitamos la ruta relativa
                    const filePathInBucket = imageUrl.split('product-images-bucket/')[1];
                    if (filePathInBucket) {
                        const { error: removeError } = await supabase.storage.from('product-images-bucket').remove([filePathInBucket]);
                        if (removeError) {
                            console.warn('Error al eliminar imagen huérfana:', removeError.message);
                        }
                    }
                }
                return;
            }

            showMessage('Producto subido exitosamente!', 'success');
            addProductForm.reset();
            fileNameDisplay.textContent = 'Ningún archivo seleccionado';
            imagePreview.src = '#';
            imagePreview.style.display = 'none';

        } catch (err) {
            console.error('Ocurrió un error inesperado al subir el producto:', err);
            showMessage('Ocurrió un error inesperado al subir el producto. Por favor, inténtalo de nuevo.', 'error');
        }
    });
});