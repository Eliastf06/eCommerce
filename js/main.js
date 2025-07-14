// js/main.js

import { supabase, showMessage } from './auth.js';
// Importa las funciones directamente desde modal-cart.js
import { addProductToCart, updateCartCountDisplay } from './modal-cart.js'; 

let allProducts = []; // Almacena todos los productos cargados

document.addEventListener('DOMContentLoaded', async () => {
    const productsContainer = document.getElementById('products-container');
    const loadingProductsMessage = document.getElementById('loading-products-message');
    const noProductsMessage = document.getElementById('no-products-message');
    
    // Elementos para filtro y búsqueda
    const categoryFilter = document.getElementById('categoryFilter'); 
    const productSearchInput = document.getElementById('productSearch');
    const searchButton = document.getElementById('searchButton');
    const pageMessageContainer = document.getElementById('page-message-container');

    // --- Función para mostrar mensajes en la página principal ---
    function showPageMessage(message, type = 'info') {
        if (pageMessageContainer) {
            pageMessageContainer.textContent = message;
            pageMessageContainer.className = `message-container ${type}`;
            pageMessageContainer.style.display = 'block';
            setTimeout(() => {
                pageMessageContainer.style.display = 'none';
            }, 3000);
        } else {
            console.warn('Contenedor de mensajes en la página (#page-message-container) no encontrado. Mensaje:', message);
            // Fallback a showMessage si pageMessageContainer no existe
            showMessage(message, type);
        }
    }

    // --- Función para renderizar los productos en el HTML ---
    // Esta función ahora es única para mostrar cualquier conjunto de productos
    function displayProducts(productsToDisplay) {
        productsContainer.innerHTML = ''; // Limpiar listados existentes

        if (productsToDisplay.length === 0) {
            productsContainer.innerHTML = '<p class="no-products-found">No se encontraron productos que coincidan con tu búsqueda.</p>';
            return;
        }

        productsToDisplay.forEach(product => {
            const productCard = document.createElement('div');
            productCard.classList.add('product-card');
            productCard.innerHTML = `
                <img src="${product.image_url || 'https://via.placeholder.com/200'}" alt="${product.name}">
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p>${product.description || 'Sin descripción.'}</p>
                    <p class="product-price">$${product.price.toFixed(2)}</p>
                    <p>Stock: ${product.stock}</p>
                    <button class="add-to-cart-btn" data-id="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock === 0 ? 'Sin Stock' : 'Añadir al Carrito'}
                    </button>
                    <a href="product-detail.html?id=${product.id}" class="btn-view-details">Ver Detalles</a>
                </div>
            `;
            productsContainer.appendChild(productCard);
        });

        // Añadir event listeners a los botones "Añadir al Carrito"
        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const productId = e.target.dataset.id;
                const productToAdd = allProducts.find(p => p.id == productId); // Usar == para comparar string con number
                if (productToAdd && productToAdd.stock > 0) {
                    await addProductToCart(productId, 1); // Añadir 1 unidad
                } else {
                    showPageMessage('Este producto no está disponible o no hay stock.', 'error');
                }
            });
        });
    }

    // --- Cargar Productos desde Supabase ---
    async function fetchProducts() {
        loadingProductsMessage.style.display = 'block';
        noProductsMessage.style.display = 'none';
        
        try {
            const { data: products, error } = await supabase
                .from('products')
                .select('*');

            if (error) {
                console.error('Error al cargar productos:', error);
                showMessage('Error al cargar productos. Intenta de nuevo más tarde.', 'error');
                loadingProductsMessage.style.display = 'none';
                return;
            }

            allProducts = products; // Almacenar todos los productos cargados
            loadingProductsMessage.style.display = 'none';

            if (products.length === 0) {
                noProductsMessage.style.display = 'block';
            } else {
                // Rellenar las opciones del filtro de categoría
                if (categoryFilter) {
                    const categories = [...new Set(allProducts.map(product => product.category).filter(Boolean))]; // Obtener categorías únicas
                    categoryFilter.innerHTML = '<option value="all">Todas las Categorías</option>'; // Opción por defecto
                    categories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        categoryFilter.appendChild(option);
                    });
                }
                displayProducts(allProducts); // Mostrar todos los productos inicialmente
            }
        } catch (err) {
            console.error('Error inesperado al cargar productos:', err);
            showPageMessage('Ocurrió un error inesperado al cargar los productos.', 'error');
            loadingProductsMessage.style.display = 'none';
        }
    }

    // --- Funcionalidad de Filtrado y Búsqueda ---
    function filterProducts() {
        const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
        const searchTerm = productSearchInput ? productSearchInput.value.toLowerCase().trim() : '';

        let filteredProducts = allProducts; // Siempre empezamos filtrando desde todos los productos

        // 1. Filtrar por categoría (si se ha seleccionado una)
        if (selectedCategory !== 'all') {
            filteredProducts = filteredProducts.filter(product => product.category === selectedCategory);
        }

        // 2. Filtrar por término de búsqueda (si hay uno)
        if (searchTerm) {
            filteredProducts = filteredProducts.filter(product =>
                product.name.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm))
            );
        }

        displayProducts(filteredProducts); // Mostrar los productos que cumplen los filtros

        // Mostrar mensaje si no hay resultados después del filtrado
        if (filteredProducts.length === 0) {
            showPageMessage('No se encontraron productos que coincidan con los filtros aplicados.', 'info');
        } else {
            // Ocultar mensaje si hay resultados
            if (pageMessageContainer) pageMessageContainer.style.display = 'none';
        }
    }

    // --- Event Listeners para la nueva funcionalidad de Filtrado y Búsqueda ---
    if (categoryFilter) {
        // Al seleccionar una categoría, busca de inmediato
        categoryFilter.addEventListener('change', filterProducts);
    }
    if (searchButton) {
        // Al hacer clic en el botón de búsqueda, busca
        searchButton.addEventListener('click', filterProducts);
    }
    if (productSearchInput) {
        // Al presionar Enter en el campo de búsqueda, busca
        productSearchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                filterProducts();
            }
        });
    }

    // --- Inicialización ---
    // Escuchar cambios de autenticación para actualizar el carrito en el header
    supabase.auth.onAuthStateChange((event, session) => {
        updateCartCountDisplay(); // Usamos la función de modal-cart.js
    });

    // Llamada inicial para actualizar el conteo del carrito y cargar los productos
    await updateCartCountDisplay(); // Actualiza el contador del carrito al cargar la página
    await fetchProducts(); // Cargar los productos al inicio (y mostrará todos por defecto)
});


// Exportamos getProductById para que product-detail.js o cualquier otro módulo pueda obtener detalles del producto.
export const getProductById = (id) => {
    // Asegúrate de que `allProducts` esté lleno cuando se llame a esta función.
    return allProducts.find(product => product.id == id);
};