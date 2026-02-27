
// ============================================
// SISTEMA DE ACORDEÓN DINÁMICO V27
// ============================================
// Cada panel es colapsable mediante su header
// Los paneles abiertos se expanden para ocupar el espacio disponible

(function() {
    'use strict';

    // Estado global del acordeón
    const AccordionState = {
        panels: new Map(), // Almacena el estado de cada panel
        container: null,
        dashboard: null,
        resizeObserver: null
    };

    // Inicializar el sistema de acordeón
    function initAccordion() {
        AccordionState.dashboard = document.querySelector('.v27-dashboard');
        if (!AccordionState.dashboard) {
            console.warn('Dashboard no encontrado');
            return;
        }

        // Configurar observer para detectar cambios en el DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    setupPanels();
                }
            });
        });

        observer.observe(AccordionState.dashboard, { childList: true, subtree: true });

        // Configurar resize observer para ajustes dinámicos
        AccordionState.resizeObserver = new ResizeObserver(entries => {
            requestAnimationFrame(adjustLayout);
        });

        AccordionState.resizeObserver.observe(AccordionState.dashboard);

        // Setup inicial
        setupPanels();

        console.log('✅ Sistema de Acordeón V27 inicializado');
    }

    // Configurar cada panel como acordeón
    function setupPanels() {
        const panels = document.querySelectorAll('.v27-panel');

        panels.forEach((panel, index) => {
            const panelId = panel.id || `panel-${index}`;

            // Evitar re-procesar paneles ya configurados
            if (panel.dataset.accordionSetup === 'true') return;

            const header = panel.querySelector('.panel-header');
            if (!header) return;

            // Marcar como configurado
            panel.dataset.accordionSetup = 'true';
            panel.dataset.panelId = panelId;

            // Estado inicial: abierto por defecto (excepto standby)
            const isStandby = panel.classList.contains('standby-panel');
            const isCollapsed = isStandby; // Standby empieza colapsado si está oculto

            AccordionState.panels.set(panelId, {
                element: panel,
                header: header,
                collapsed: isCollapsed,
                content: null, // Se detectará dinámicamente
                originalHeight: null
            });

            // Hacer el header clickeable
            header.style.cursor = 'pointer';
            header.style.userSelect = 'none';
            header.style.transition = 'background-color 0.3s ease';

            // Indicador visual de acordeón
            const indicator = document.createElement('span');
            indicator.className = 'accordion-indicator';
            indicator.innerHTML = isCollapsed ? '▶' : '▼';
            indicator.style.cssText = `
                margin-left: auto;
                font-size: 12px;
                color: #00d4ff;
                transition: transform 0.3s ease;
                padding: 4px 8px;
                background: rgba(0, 212, 255, 0.1);
                border-radius: 4px;
                font-family: 'JetBrains Mono', monospace;
            `;

            // Asegurar que el header tenga display flex para el indicador
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'space-between';

            header.appendChild(indicator);

            // Evento de click
            header.addEventListener('click', (e) => {
                // No colapsar si se hizo click en un botón o control dentro del header
                if (e.target.closest('button') || e.target.closest('.logs-actions')) return;
                togglePanel(panelId);
            });

            // Hover effect
            header.addEventListener('mouseenter', () => {
                header.style.backgroundColor = 'rgba(0, 212, 255, 0.1)';
            });

            header.addEventListener('mouseleave', () => {
                header.style.backgroundColor = '';
            });

            // Si debe estar colapsado inicialmente
            if (isCollapsed) {
                collapsePanel(panelId, false); // false = sin animación inicial
            }
        });

        // Ajustar layout inicial
        adjustLayout();
    }

    // Alternar estado de un panel
    function togglePanel(panelId) {
        const state = AccordionState.panels.get(panelId);
        if (!state) return;

        if (state.collapsed) {
            expandPanel(panelId);
        } else {
            collapsePanel(panelId);
        }
    }

    // Colapsar panel
    function collapsePanel(panelId, animate = true) {
        const state = AccordionState.panels.get(panelId);
        if (!state || state.collapsed) return;

        const panel = state.element;
        const content = getPanelContent(panel);
        const indicator = state.header.querySelector('.accordion-indicator');

        // Guardar altura original si no está guardada
        if (!state.originalHeight) {
            state.originalHeight = panel.style.height || 'auto';
        }

        // Marcar como colapsado
        state.collapsed = true;
        panel.dataset.collapsed = 'true';

        // Actualizar indicador
        if (indicator) {
            indicator.innerHTML = '▶';
            indicator.style.transform = 'rotate(-90deg)';
        }

        // Aplicar estilos de colapsado
        if (animate) {
            panel.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        }

        // Altura mínima solo para el header
        const headerHeight = state.header.offsetHeight;
        panel.style.maxHeight = `${headerHeight + 30}px`; // + padding
        panel.style.overflow = 'hidden';
        panel.style.opacity = '0.8';

        // Ocultar contenido
        if (content) {
            content.style.opacity = '0';
            content.style.pointerEvents = 'none';
            content.style.transform = 'translateY(-10px)';
        }

        // Ajustar layout de otros paneles
        if (animate) {
            setTimeout(adjustLayout, 50);
        } else {
            adjustLayout();
        }

        // Evento personalizado
        dispatchAccordionEvent('panelCollapsed', { panelId, panel });
    }

    // Expandir panel
    function expandPanel(panelId) {
        const state = AccordionState.panels.get(panelId);
        if (!state || !state.collapsed) return;

        const panel = state.element;
        const content = getPanelContent(panel);
        const indicator = state.header.querySelector('.accordion-indicator');

        // Marcar como expandido
        state.collapsed = false;
        panel.dataset.collapsed = 'false';

        // Actualizar indicador
        if (indicator) {
            indicator.innerHTML = '▼';
            indicator.style.transform = 'rotate(0deg)';
        }

        // Restaurar estilos
        panel.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        panel.style.maxHeight = 'none';
        panel.style.overflow = 'visible';
        panel.style.opacity = '1';

        // Mostrar contenido
        if (content) {
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
            content.style.transform = 'translateY(0)';
            content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        }

        // Ajustar layout
        setTimeout(adjustLayout, 50);

        // Evento personalizado
        dispatchAccordionEvent('panelExpanded', { panelId, panel });
    }

    // Obtener el contenido de un panel (todo excepto el header)
    function getPanelContent(panel) {
        const children = Array.from(panel.children);
        const contentElements = children.filter(child => !child.classList.contains('panel-header'));

        // Si no hay wrapper, crear uno para el contenido
        if (contentElements.length > 0 && !panel.querySelector('.panel-content-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'panel-content-wrapper';
            wrapper.style.cssText = `
                transition: opacity 0.3s ease, transform 0.3s ease;
                height: 100%;
            `;

            contentElements.forEach(el => wrapper.appendChild(el));
            panel.appendChild(wrapper);
            return wrapper;
        }

        return panel.querySelector('.panel-content-wrapper') || null;
    }

    // Ajustar layout dinámico - DISTRIBUIR ESPACIO ENTRE PANELES ABIERTOS
    function adjustLayout() {
        const dashboard = AccordionState.dashboard;
        if (!dashboard) return;

        const allPanels = Array.from(document.querySelectorAll('.v27-panel'));
        const expandedPanels = allPanels.filter(p => p.dataset.collapsed !== 'true');
        const collapsedPanels = allPanels.filter(p => p.dataset.collapsed === 'true');

        if (expandedPanels.length === 0) return;

        // Calcular espacio disponible
        const dashboardHeight = dashboard.clientHeight;
        const dashboardStyle = window.getComputedStyle(dashboard);
        const gap = parseInt(dashboardStyle.gap) || 15;

        // Altura ocupada por paneles colapsados (solo headers)
        const collapsedHeight = collapsedPanels.reduce((total, panel) => {
            const header = panel.querySelector('.panel-header');
            return total + (header ? header.offsetHeight + 30 : 50); // + padding/margins
        }, 0);

        // Espacio disponible para paneles expandidos
        const availableHeight = dashboardHeight - collapsedHeight - (gap * (allPanels.length - 1));
        const heightPerPanel = Math.floor(availableHeight / expandedPanels.length);

        // Aplicar alturas dinámicas
        expandedPanels.forEach((panel, index) => {
            // No forzar altura fija, permitir flexibilidad
            panel.style.flex = '1 1 auto';
            panel.style.minHeight = '200px'; // Mínimo para contenido usable

            // Si es el último panel, darle flex-grow extra para ocupar espacio restante
            if (index === expandedPanels.length - 1) {
                panel.style.flex = '2 1 auto';
            }
        });

        // Paneles colapsados: altura mínima
        collapsedPanels.forEach(panel => {
            const header = panel.querySelector('.panel-header');
            const headerHeight = header ? header.offsetHeight : 40;
            panel.style.flex = '0 0 auto';
            panel.style.height = 'auto';
            panel.style.maxHeight = `${headerHeight + 30}px`;
            panel.style.minHeight = 'auto';
        });

        // Ajustar grid si es necesario
        updateGridLayout(expandedPanels.length);
    }

    // Actualizar layout del grid según disponibilidad
    function updateGridLayout(openCount) {
        const dashboard = AccordionState.dashboard;
        if (!dashboard) return;

        // En móvil: siempre 1 columna
        if (window.innerWidth <= 900) {
            dashboard.style.gridTemplateColumns = '1fr';
            return;
        }

        // En desktop: ajustar columnas según paneles abiertos
        if (openCount === 1) {
            dashboard.style.gridTemplateColumns = '1fr'; // Un panel = full width
        } else if (openCount === 2) {
            dashboard.style.gridTemplateColumns = 'repeat(2, 1fr)';
        } else if (openCount >= 3) {
            dashboard.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
        }
    }

    // Expandir todos los paneles
    function expandAll() {
        AccordionState.panels.forEach((state, panelId) => {
            if (state.collapsed) {
                expandPanel(panelId);
            }
        });
    }

    // Colapsar todos excepto uno específico (modo focus)
    function focusPanel(keepPanelId) {
        AccordionState.panels.forEach((state, panelId) => {
            if (panelId === keepPanelId) {
                expandPanel(panelId);
            } else {
                collapsePanel(panelId);
            }
        });
    }

    // Evento personalizado
    function dispatchAccordionEvent(type, detail) {
        const event = new CustomEvent('accordion:' + type, { detail });
        document.dispatchEvent(event);
    }

    // API pública
    window.AccordionV27 = {
        init: initAccordion,
        toggle: togglePanel,
        expand: expandPanel,
        collapse: collapsePanel,
        expandAll: expandAll,
        focus: focusPanel,
        getState: () => {
            const state = {};
            AccordionState.panels.forEach((value, key) => {
                state[key] = { collapsed: value.collapsed };
            });
            return state;
        },
        // Nuevo: expandir paneles prioritarios según contexto
        autoOptimize: function(signalType) {
            // Expandir paneles relevantes según el tipo de señal
            const priorityMap = {
                'buy': ['technical-panel', 'ml-panel', 'risk-panel'],
                'sell': ['technical-panel', 'ml-panel', 'risk-panel'],
                'trap': ['trap-panel', 'risk-panel'],
                'standby': ['standby-panel']
            };

            const priorities = priorityMap[signalType] || [];

            AccordionState.panels.forEach((state, panelId) => {
                const panel = state.element;
                const panelClass = panel.className;

                const isPriority = priorities.some(p => panelClass.includes(p) || panelId.includes(p));

                if (isPriority) {
                    expandPanel(panelId);
                } else {
                    // Mantener abiertos los que ya estaban, o colapsar según preferencia
                    // Por defecto, mantener técnico y ML siempre visibles
                    const isEssential = panelClass.includes('technical-panel') || 
                                       panelClass.includes('ml-panel');
                    if (!isEssential && !state.collapsed) {
                        collapsePanel(panelId);
                    }
                }
            });
        }
    };

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccordion);
    } else {
        // Si ya cargó, inicializar con delay para asegurar que todo esté renderizado
        setTimeout(initAccordion, 100);
    }

    // Re-ajustar en resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(adjustLayout, 100);
    });

})();