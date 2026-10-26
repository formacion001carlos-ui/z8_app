<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TimeTrack | Agente</title>
    <link rel="icon" href="https://cdn-icons-png.flaticon.com/512/2088/2088617.png" type="image/png">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { background-color: #f8fafc; font-family: 'Inter', sans-serif; color: #334155; }
        
        .bento-panel { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
        
        .state-btn { background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px 8px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: all 0.2s; }
        .state-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .state-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 12px; }
        .state-btn span { font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
        
        .active-work { border-color: #16a34a; background: #f0fdf4; }
        .active-work .state-icon { background: #16a34a; }
        .active-break { border-color: #2563eb; background: #eff6ff; }
        .active-break .state-icon { background: #2563eb; }
        .active-pause { border-color: #d97706; background: #fffbeb; }
        .active-pause .state-icon { background: #d97706; }
        .active-off { border-color: #94a3b8; background: #f8fafc; }
        .active-off .state-icon { background: #94a3b8; }

        .btn-generic { background-color: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; transition: all 0.2s; display: inline-flex; justify-content: center; align-items: center;}
        .btn-generic:hover { background-color: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.2); }
        .btn-secondary { background-color: white; color: #475569; border: 1px solid #cbd5e1; }
        .btn-secondary:hover { background-color: #f1f5f9; color: #0f172a; }

        .progress-track { background: #e2e8f0; border-radius: 99px; height: 10px; overflow: hidden; width: 100%; position: relative; }
        .progress-fill { background: #2563eb; height: 100%; border-radius: 99px; transition: width 0.5s ease; width: 0%; }
        .progress-overtime { background: #d97706 !important; box-shadow: 0 0 10px rgba(217, 119, 6, 0.5); }

        #toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 50; display: flex; flex-direction: column; gap: 10px; }
        .toast { background: white; color: #1e293b; padding: 12px 20px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-left: 4px solid #2563eb; font-size: 13px; font-weight: 600; animation: slideIn 0.3s forwards; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    </style>
</head>
<body>
    <div id="toast-container"></div>

    <div class="max-w-[1580px] mx-auto pt-5 pb-16 px-4">
        <header class="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-800">TimeTrack<span class="text-blue-600">.</span></h1>
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Panel de Agente</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <button type="button" id="btn-tema-z8" onclick="ciclarTemaZ8()" class="btn-generic btn-secondary text-xs !py-2 !px-3">🌓 Auto</button>
                <button type="button" onclick="abrirModalPerfilZ8()" class="btn-generic btn-secondary text-xs !py-1.5 !px-3 flex items-center gap-2">
                    <span id="header-avatar-agente-z8"></span>
                    <div class="text-left leading-tight">
                        <div class="font-bold text-slate-800 text-xs">Mi Perfil</div>
                        <div id="header-servicio-agente-z8" class="text-[10px] text-blue-600 font-semibold">Agente</div>
                    </div>
                </button>
                <button onclick="cerrarSesion()" class="btn-generic btn-secondary text-xs !py-2 !px-4">Cerrar sesión</button>
            </div>
        </header>

        <!-- AVISO DE SETUP DE PERFIL SI FALTAN DATOS -->
        <div id="banner-setup-perfil-z8" class="hidden mb-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 text-xs text-blue-900">
                <span class="text-lg">👋</span>
                <div>
                    <span class="font-bold">¡Completa tu ficha de perfil!</span>
                    <span class="text-slate-600 ml-1">Añade tu foto, móvil, WhatsApp y correo en 30 segundos.</span>
                </div>
            </div>
            <button type="button" onclick="abrirModalPerfilZ8()" class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition">
                Completar mi perfil →
            </button>
        </div>

        <div id="loading-overlay" class="fixed inset-0 bg-white/80 backdrop-blur-sm z-40 flex items-center justify-center">
            <div class="text-blue-600 font-bold animate-pulse">Sincronizando matriz...</div>
        </div>

        <!-- LAYOUT PRINCIPAL: IZQUIERDA OPERATIVA + DERECHA CHAT SIEMPRE VISIBLE -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div class="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- TARJETA DE ESTADO -->
            <div id="tarjeta-estado" class="bento-panel flex flex-col justify-center border-l-4 border-slate-400 transition-colors duration-300">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hola, <span id="lbl-nombre">Agente</span></div>
                <div class="flex items-center mb-1">
                    <div id="icono-estado-mini" class="w-3 h-3 rounded-full bg-slate-400 mr-2 shadow-sm transition-colors duration-300"></div>
                    <span id="texto-estado" class="font-bold text-2xl text-slate-800 uppercase tracking-tight">Desconectado</span>
                </div>
                <p id="texto-tarea" class="text-sm text-blue-600 font-bold mb-1"></p>
                <p id="texto-hora-inicio" class="text-xs text-slate-500 font-medium mb-4">Tu jornada no está activa.</p>
                
                <div class="mt-auto flex gap-2">
                    <input type="text" id="input-actividad" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 transition" placeholder="¿Qué estás haciendo?">
                    <button onclick="actualizarActividad()" class="btn-generic !py-2 !px-4 text-sm whitespace-nowrap">Fijar Tarea</button>
                </div>
            </div>

            <!-- TARJETA DE PROGRESO -->
            <div class="bento-panel flex flex-col justify-center">
                <div class="flex justify-between items-end mb-3">
                    <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progreso Diario</h3>
                    <div class="text-right">
                        <span id="tiempo-real-txt" class="text-2xl font-bold text-blue-700 font-mono tracking-tighter">00:00:00</span>
                        <span class="text-xs font-semibold text-slate-400"> / <span id="tiempo-objetivo-txt">08:00:00</span></span>
                    </div>
                </div>
                <div class="progress-track mb-3">
                    <div id="barra-progreso" class="progress-fill"></div>
                </div>
                <p id="mensaje-progreso" class="text-xs text-slate-500 font-medium">Iniciando sistema...</p>
            </div>

            <!-- BOTONERA OPERATIVA -->
            <div class="bento-panel md:col-span-2">
                <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Acciones Operativas</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button id="btn-work" onclick="cambiarEstadoUI('Conectado')" class="state-btn">
                        <div class="state-icon bg-slate-300"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg></div>
                        <span>Trabajar</span>
                    </button>
                    <button id="btn-break" onclick="cambiarEstadoUI('Descanso')" class="state-btn">
                        <div class="state-icon bg-slate-300"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                        <span>Descanso</span>
                    </button>
                    <button id="btn-pause" onclick="cambiarEstadoUI('Pausado')" class="state-btn">
                        <div class="state-icon bg-slate-300"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></div>
                        <span>Pausar</span>
                    </button>
                    <button id="btn-off" onclick="cambiarEstadoUI('Desconectado')" class="state-btn active-off">
                        <div class="state-icon bg-slate-400"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"></path></svg></div>
                        <span>Desconectar</span>
                    </button>
                </div>
            </div>

            <!-- MÓDULO 1: REGISTRO TOTAL DE HORAS DEL MES -->
            <div id="seccion-mensual" class="bento-panel md:col-span-2 mt-2">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
                    <div>
                        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Mi Registro Mensual de Horas
                        </h3>
                        <p class="text-xs text-slate-400 mt-0.5">Resumen acumulado del mes y detalle día por día</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="month" id="agente-mes-selector" onchange="cargarDatosMensualesAgente()" class="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:border-blue-500">
                        <button onclick="cargarDatosMensualesAgente()" class="btn-generic btn-secondary !py-1.5 !px-3 !text-xs">↻ Actualizar</button>
                    </div>
                </div>

                <!-- 3 Tarjetas de Resumen del Mes -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                    <div class="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                        <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Trabajado Mes</div>
                        <div id="mes-total-trabajado" class="text-2xl font-bold font-mono text-blue-800">00:00:00</div>
                        <div id="mes-desglose-lab-finde" class="text-[11px] text-slate-500 mt-1">Lab: 00:00:00 · Finde: 00:00:00</div>
                    </div>
                    <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Horas Previstas (Meta)</div>
                        <div id="mes-total-previsto" class="text-2xl font-bold font-mono text-slate-700">00:00:00</div>
                        <div id="mes-meta-diaria-txt" class="text-[11px] text-slate-400 mt-1">Objetivo: 8h / día laborable</div>
                    </div>
                    <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Balance / Diferencia</div>
                        <div id="mes-diferencia" class="text-2xl font-bold font-mono text-slate-700">00:00:00</div>
                        <div id="mes-diferencia-sub" class="text-[11px] text-slate-400 mt-1">Respecto al total mensual</div>
                    </div>
                </div>

                <!-- Desglose Diario del Mes -->
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detalle por Días (Del 1 al final del mes)</span>
                    <label class="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                        <input type="checkbox" id="chk-mostrar-todo-mes" onchange="renderTablaDiasAgente()" class="rounded text-blue-600">
                        Ver mes completo
                    </label>
                </div>
                <div class="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded-xl shadow-inner bg-slate-50/30">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-100 sticky top-0 z-10 border-b-2 border-slate-200">
                            <tr>
                                <th class="py-2.5 px-3 text-[10px] font-bold text-slate-500 uppercase">Día</th>
                                <th class="py-2.5 px-3 text-[10px] font-bold text-slate-500 uppercase">Horas Registradas</th>
                                <th class="py-2.5 px-3 text-[10px] font-bold text-slate-500 uppercase">Estado / Ajustes</th>
                                <th class="py-2.5 px-3 text-[10px] font-bold text-slate-500 uppercase text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="tabla-dias-agente" class="text-xs">
                            <tr><td colspan="4" class="text-center py-6 text-slate-400">Cargando registro mensual...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- MÓDULO 2: SOLICITUD DE CORRECCIÓN DE HORAS (COLAPSABLE Y MINIMALISTA) -->
            <div id="seccion-correccion" class="bento-panel md:col-span-2 !p-0 overflow-hidden border border-slate-200">
                <!-- Cabecera Colapsable -->
                <button type="button" onclick="toggleModuloCorreccion()" class="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-slate-50/80 transition text-left">
                    <div class="flex items-center gap-2.5">
                        <svg class="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Solicitar Corrección de Horas</span>
                        <span id="contador-mis-solicitudes" class="hidden px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"></span>
                    </div>
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                        <span id="txt-toggle-correccion">Abrir</span>
                        <svg id="icono-toggle-correccion" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </button>

                <!-- Cuerpo Colapsable (Oculto por defecto) -->
                <div id="cuerpo-correccion" class="hidden px-6 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                        <div class="md:col-span-3">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Día</label>
                            <input type="date" id="corr-fecha" onchange="actualizarPreviewCorreccion()" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white">
                        </div>

                        <div class="md:col-span-4">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Acción</label>
                            <select id="corr-tipo" onchange="actualizarPreviewCorreccion()" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white font-medium text-slate-700">
                                <option value="sumar">+ Sumar horas faltantes</option>
                                <option value="restar">- Restar horas de más</option>
                                <option value="fijar">= Fijar total del día en...</option>
                            </select>
                        </div>

                        <div class="md:col-span-3">
                            <label id="lbl-corr-tiempo" class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horas : Minutos</label>
                            <div class="flex items-center gap-1">
                                <input type="number" id="corr-horas" min="0" max="23" value="1" oninput="actualizarPreviewCorreccion()" class="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-center outline-none focus:border-blue-500 bg-white" placeholder="HH">
                                <span class="font-bold text-slate-400">:</span>
                                <input type="number" id="corr-minutos" min="0" max="59" value="0" oninput="actualizarPreviewCorreccion()" class="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-center outline-none focus:border-blue-500 bg-white" placeholder="MM">
                            </div>
                        </div>

                        <div class="md:col-span-2">
                            <button onclick="enviarSolicitudCorreccion()" class="btn-generic w-full !py-1.5 !text-xs shadow-sm">Enviar</button>
                        </div>

                        <div class="md:col-span-12 mt-1">
                            <input type="text" id="corr-motivo" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white" placeholder="Motivo breve (obligatorio): ej. olvidé fichar al volver del descanso...">
                        </div>
                    </div>

                    <div id="corr-preview-box" class="mt-2.5 px-3 py-1.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800">
                        <span id="corr-preview-txt"></span>
                    </div>

                    <!-- Historial compacto (solo visible si tiene solicitudes) -->
                    <div id="contenedor-mis-solicitudes" class="hidden mt-4 pt-3 border-t border-slate-200/70">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Mis Solicitudes</div>
                        <div id="lista-mis-solicitudes" class="space-y-1.5"></div>
                    </div>
                </div>
            </div>

            <!-- MÓDULO 3: NOTAS / TEMAS PARA REUNIÓN (COLAPSABLE Y MINIMALISTA) -->
            <div id="seccion-notas-reunion" class="bento-panel md:col-span-2 !p-0 overflow-hidden border border-slate-200">
                <button type="button" onclick="toggleModuloNotasReunion()" class="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-slate-50/80 transition text-left">
                    <div class="flex items-center gap-2.5">
                        <span class="text-base">📋</span>
                        <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Notas y Temas para Reunión</span>
                        <span id="contador-notas-reunion-agente" class="hidden px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800"></span>
                    </div>
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                        <span id="txt-toggle-notas">Abrir</span>
                        <svg id="icono-toggle-notas" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </button>

                <div id="cuerpo-notas-reunion" class="hidden px-6 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50">
                    <p class="text-[11px] text-slate-500 mb-2.5">Propón un tema, duda o caso para tratar en la próxima reunión de equipo y consulta la resolución de cada punto.</p>
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-center mb-4">
                        <div class="md:col-span-3">
                            <select id="nota-reunion-cat" class="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs bg-white font-semibold text-slate-700">
                                <option value="Operativa">📌 Operativa</option>
                                <option value="Técnico">💻 Técnico / Sistema</option>
                                <option value="Duda">❓ Duda</option>
                                <option value="Sugerencia">💡 Sugerencia</option>
                            </select>
                        </div>
                        <div class="md:col-span-7">
                            <input type="text" id="nota-reunion-tema" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white outline-none focus:border-blue-500" placeholder="Escribe el tema o caso a tratar en reunión...">
                        </div>
                        <div class="md:col-span-2">
                            <button type="button" onclick="proponerNotaReunionAgente()" class="btn-generic w-full !py-2 !text-xs shadow-sm">Proponer</button>
                        </div>
                    </div>

                    <div id="lista-notas-reunion-agente" class="space-y-2 max-h-72 overflow-y-auto">
                        <div class="text-center py-4 text-xs text-slate-400">Cargando temas de reunión...</div>
                    </div>
                </div>
            </div>

            </div>

            <!-- COLUMNA DERECHA SIEMPRE EN VISTA: CHAT DE EQUIPO Y CANALES -->
            <div id="chat-embedded-mount-z8" class="xl:col-span-5 xl:sticky xl:top-5"></div>

        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="api.js"></script>
    
    <script>
        let usuarioActivo = localStorage.getItem('tt_usuario');
        let rolActivo = localStorage.getItem('tt_rol');
        let estadoApp = "Desconectado";
        
        let horaInicioGlobal = null;
        let cronometroVirtual = null;
        let baseSegundosDiarios = 0; 
        let objetivoSegundos = 8 * 3600; 
        let latidoTimer = null;
        let heartbeatWorker = null;
        let overtimeAvisado = false;

        let datosMensualesAgente = null;
        let solicitudesAgente = [];
        let notasReunionAgente = [];

        // Barrera de seguridad
        if (!usuarioActivo || rolActivo !== 'agente') window.location.href = 'index.html';
        document.getElementById('lbl-nombre').textContent = usuarioActivo;

        // Método blindado para obtener la hora de Madrid sin crashear navegadores
        function getHoraActualMadridAsLocal() {
            try {
                const now = new Date();
                const str = now.toLocaleString("en-US", { timeZone: "Europe/Madrid", hour12: false });
                const parts = str.split(", ");
                const dateParts = parts[0].split("/");
                let timeParts = parts[1].trim().split(":");
                
                let h = parseInt(timeParts[0]);
                if (h === 24) h = 0;
                
                return new Date(dateParts[2], parseInt(dateParts[0])-1, dateParts[1], h, parseInt(timeParts[1]), parseInt(timeParts[2]));
            } catch (e) {
                return new Date(); 
            }
        }

        function formatoHMS(totalSegundos) {
            const segs = Math.max(0, Math.floor(Math.abs(totalSegundos || 0)));
            let h = Math.floor(segs / 3600);
            let m = Math.floor((segs % 3600) / 60);
            let s = segs % 60;
            return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
        }

        window.onload = async () => {
            const ahora = getHoraActualMadridAsLocal();
            const yyyy = ahora.getFullYear();
            const mm = String(ahora.getMonth() + 1).padStart(2, '0');
            const dd = String(ahora.getDate()).padStart(2, '0');
            document.getElementById('agente-mes-selector').value = `${yyyy}-${mm}`;
            document.getElementById('corr-fecha').value = `${yyyy}-${mm}-${dd}`;

            await refrescarDatosBackend();
            await cargarDatosMensualesAgente();
            await cargarNotasReunionAgente();
            if (typeof iniciarSuiteInteractivaZ8 === 'function') {
                await iniciarSuiteInteractivaZ8({ usuario: usuarioActivo, rol: rolActivo });
            }
            iniciarLatidos();
            if (typeof iniciarDetectorVersion === 'function') iniciarDetectorVersion();
            document.getElementById('loading-overlay').classList.add('hidden');
        };

        window.recargarNotasReunionUI = cargarNotasReunionAgente;

        function toggleModuloNotasReunion(forzarAbrir) {
            const cuerpo = document.getElementById('cuerpo-notas-reunion');
            const icono = document.getElementById('icono-toggle-notas');
            const txt = document.getElementById('txt-toggle-notas');
            const estaOculto = cuerpo.classList.contains('hidden');
            const abrir = (typeof forzarAbrir === 'boolean') ? forzarAbrir : estaOculto;
            if (abrir) {
                cuerpo.classList.remove('hidden');
                icono.classList.add('rotate-180');
                txt.textContent = 'Cerrar';
            } else {
                cuerpo.classList.add('hidden');
                icono.classList.remove('rotate-180');
                txt.textContent = 'Abrir';
            }
        }

        async function cargarNotasReunionAgente() {
            try {
                const lista = await fetchGoogleAPI("getNotasReunion", {});
                notasReunionAgente = lista || [];
                const badge = document.getElementById('contador-notas-reunion-agente');
                const cont = document.getElementById('lista-notas-reunion-agente');
                const pendientes = notasReunionAgente.filter(n => !n.resuelto).length;

                if (notasReunionAgente.length > 0) {
                    badge.textContent = pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : `${notasReunionAgente.length} temas`;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }

                if (notasReunionAgente.length === 0) {
                    cont.innerHTML = `<div class="text-center py-4 text-xs text-slate-400">Aún no hay temas propuestos para la reunión.</div>`;
                    return;
                }

                let html = '';
                notasReunionAgente.forEach(n => {
                    const fechaStr = n.creadoEn ? new Date(n.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '';
                    const checkBadge = n.resuelto
                        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">✅ Tratado</span>`
                        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">⏳ Pendiente</span>`;
                    const btnBorrar = (!n.resuelto && n.autor === usuarioActivo)
                        ? `<button onclick="eliminarMiNotaReunionAgente('${n.id}')" class="text-[10px] font-bold text-red-500 hover:underline ml-2">Eliminar</button>`
                        : '';
                    const resolucionHtml = n.resolucion
                        ? `<div class="mt-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                               <span class="font-bold">📌 Resolución:</span> ${escaparHTMLZ8(n.resolucion)}
                           </div>`
                        : '';

                    html += `
                        <div class="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-start gap-2">
                                    <input type="checkbox" disabled ${n.resuelto ? 'checked' : ''} class="mt-0.5 rounded text-green-600">
                                    <div>
                                        <div class="font-bold text-slate-800">${escaparHTMLZ8(n.tema)}</div>
                                        <div class="text-[10px] text-slate-400 mt-0.5">
                                            Propuesto por <b>${escaparHTMLZ8(n.autor)}</b> · <span class="text-blue-600 font-semibold">${escaparHTMLZ8(n.categoria)}</span> · ${fechaStr}
                                        </div>
                                        ${resolucionHtml}
                                    </div>
                                </div>
                                <div class="flex items-center shrink-0">
                                    ${checkBadge}
                                    ${btnBorrar}
                                </div>
                            </div>
                        </div>
                    `;
                });
                cont.innerHTML = html;
            } catch (e) {}
        }

        async function proponerNotaReunionAgente() {
            const cat = document.getElementById('nota-reunion-cat').value;
            const inp = document.getElementById('nota-reunion-tema');
            const tema = inp.value.trim();
            if (!tema) {
                showToast("⚠️ Escribe el tema que quieres proponer para la reunión.", true);
                inp.focus();
                return;
            }
            try {
                await fetchGoogleAPI("crearNotaReunion", {
                    usuario: usuarioActivo,
                    rol: rolActivo,
                    categoria: cat,
                    tema: tema
                });
                inp.value = '';
                showToast("✅ Tema añadido a la lista de reunión.");
                await cargarNotasReunionAgente();
            } catch (e) {
                showToast("❌ Error al guardar el tema.", true);
            }
        }

        async function eliminarMiNotaReunionAgente(id) {
            if (!confirm("¿Eliminar este tema de la lista de reunión?")) return;
            try {
                await fetchGoogleAPI("eliminarNotaReunion", { id });
                await cargarNotasReunionAgente();
            } catch (e) {}
        }

        function toggleModuloCorreccion(forzarAbrir) {
            const cuerpo = document.getElementById('cuerpo-correccion');
            const icono = document.getElementById('icono-toggle-correccion');
            const txt = document.getElementById('txt-toggle-correccion');
            const estaOculto = cuerpo.classList.contains('hidden');
            const abrir = (typeof forzarAbrir === 'boolean') ? forzarAbrir : estaOculto;

            if (abrir) {
                cuerpo.classList.remove('hidden');
                icono.classList.add('rotate-180');
                txt.textContent = 'Cerrar';
                actualizarPreviewCorreccion();
            } else {
                cuerpo.classList.add('hidden');
                icono.classList.remove('rotate-180');
                txt.textContent = 'Abrir';
            }
        }

        function showToast(msg, isOvertime = false) {
            const container = document.getElementById('toast-container');
            const t = document.createElement('div');
            t.className = 'toast';
            if (isOvertime) t.style.borderLeftColor = '#d97706';
            t.textContent = msg;
            container.appendChild(t);
            setTimeout(() => t.remove(), 4000);
        }

        function cerrarSesion() {
            localStorage.clear();
            window.location.href = 'index.html';
        }

        async function refrescarDatosBackend() {
            try {
                const data = await fetchGoogleAPI("getEstado", { usuario: usuarioActivo });

                baseSegundosDiarios = data.segundosAcumuladosHoy || 0; 
                
                let horasMeta = data.horasObjetivo ? parseFloat(data.horasObjetivo) : 8;
                objetivoSegundos = horasMeta * 3600;
                
                document.getElementById('tiempo-objetivo-txt').textContent = formatoHMS(objetivoSegundos);

                let vInicio = (data.inicio && data.inicio !== "undefined" && data.inicio !== "-") ? data.inicio : ((data.horaInicio && data.horaInicio !== "undefined" && data.horaInicio !== "-") ? data.horaInicio : getHoraActualMadridAsLocal().toLocaleTimeString('es-ES', {hour12:false}));
                aplicarEstadoLocal(data.estado, vInicio, data.actividad);
            } catch (error) {
                showToast("Fallo de conexión. Intentando reanudar...", false);
            }
        }

        async function cargarDatosMensualesAgente() {
            try {
                const mesSel = document.getElementById('agente-mes-selector').value;
                const resp = await fetchGoogleAPI("getAgentMonthlyData", {
                    usuario: usuarioActivo,
                    month: mesSel
                });
                datosMensualesAgente = resp;
                solicitudesAgente = resp.solicitudes || [];

                const res = resp.resumen;
                document.getElementById('mes-total-trabajado').textContent = formatoHMS(res.totalMes || 0);
                document.getElementById('mes-desglose-lab-finde').textContent = `Lab: ${formatoHMS(res.horasLaborables || 0)} · Finde: ${formatoHMS(res.horasFinde || 0)}`;
                document.getElementById('mes-total-previsto').textContent = formatoHMS(res.previstas || 0);
                document.getElementById('mes-meta-diaria-txt').textContent = `Objetivo: ${res.horasObjetivoDiarias || 8}h / día laborable`;

                const diffSegs = (res.totalMes || 0) - (res.previstas || 0);
                const diffEl = document.getElementById('mes-diferencia');
                const diffSub = document.getElementById('mes-diferencia-sub');
                diffEl.textContent = (diffSegs < 0 ? "-" : "+") + formatoHMS(Math.abs(diffSegs));
                if (diffSegs < 0) {
                    diffEl.className = "text-2xl font-bold font-mono text-amber-600";
                    diffSub.textContent = "Horas restantes para la meta mensual";
                } else {
                    diffEl.className = "text-2xl font-bold font-mono text-green-600";
                    diffSub.textContent = "Saldo positivo / horas extra este mes";
                }

                renderTablaDiasAgente();
                renderMisSolicitudes();
                actualizarPreviewCorreccion();
            } catch (e) {
                console.error("Error cargando resumen mensual:", e);
            }
        }

        function renderTablaDiasAgente() {
            const tbody = document.getElementById('tabla-dias-agente');
            if (!datosMensualesAgente) return;

            const partes = datosMensualesAgente.mes.split("/");
            const mesNum = parseInt(partes[0], 10);
            const anoNum = parseInt(partes[1], 10);
            const diasEnMes = new Date(anoNum, mesNum, 0).getDate();
            const mostrarTodo = document.getElementById('chk-mostrar-todo-mes').checked;

            const ahora = getHoraActualMadridAsLocal();
            const esMesActual = (ahora.getFullYear() === anoNum && (ahora.getMonth() + 1) === mesNum);
            const diaHoy = ahora.getDate();

            const diasNombres = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
            const mesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

            let filasHtml = "";
            const diasMap = datosMensualesAgente.resumen.dias || {};

            // Orden de arriba hacia abajo: desde el día 1 hasta el final del mes
            for (let d = 1; d <= diasEnMes; d++) {
                const fechaStr = `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const segsDia = diasMap[d] || 0;
                const solsDia = solicitudesAgente.filter(s => s.fecha === fechaStr);

                if (!mostrarTodo) {
                    if (esMesActual && d > diaHoy && segsDia === 0 && solsDia.length === 0) continue;
                }

                const dateObj = new Date(anoNum, mesNum - 1, d);
                const dow = dateObj.getDay();
                const isFinde = (dow === 0 || dow === 6);
                const isHoy = (esMesActual && d === diaHoy);

                let badgesHtml = "";
                solsDia.forEach(s => {
                    const signo = s.ajusteSegs >= 0 ? "+" : "-";
                    const deltaTxt = `${signo}${formatoHMS(Math.abs(s.ajusteSegs))}`;
                    if (s.estado === 'SOLICITUD_PENDIENTE') {
                        badgesHtml += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 mr-1">⏳ Pendiente (${deltaTxt})</span>`;
                    } else if (s.estado === 'SOLICITUD_APROBADA') {
                        badgesHtml += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 mr-1">✅ Aprobada (${deltaTxt})</span>`;
                    } else if (s.estado === 'SOLICITUD_RECHAZADA') {
                        badgesHtml += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 mr-1">❌ Rechazada</span>`;
                    }
                });
                if (!badgesHtml) badgesHtml = `<span class="text-slate-300">—</span>`;

                const rowBg = isHoy ? "bg-blue-50/60" : (isFinde ? "bg-amber-50/25" : "bg-white");
                // Separador claro entre cada día, y separador ligeramente más marcado al cerrar la semana (domingo)
                const borderRow = (dow === 0) ? "border-b-2 border-slate-300" : "border-b border-slate-200/80";
                const tagHoy = isHoy ? `<span class="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-blue-600 text-white rounded">HOY</span>` : "";

                filasHtml += `<tr id="fila-dia-${d}" class="${rowBg} ${borderRow} hover:bg-slate-100/70 transition">
                    <td class="py-2.5 px-3 font-semibold ${isFinde ? 'text-amber-700' : 'text-slate-700'}">
                        ${diasNombres[dow]} ${String(d).padStart(2, '0')} ${mesesCortos[mesNum - 1]} ${tagHoy}
                    </td>
                    <td class="py-2.5 px-3 font-mono font-bold ${segsDia > 0 ? 'text-slate-800' : 'text-slate-300'}">
                        ${formatoHMS(segsDia)}
                    </td>
                    <td class="py-2.5 px-3">${badgesHtml}</td>
                    <td class="py-2.5 px-3 text-right">
                        <button onclick="seleccionarDiaParaCorregir('${fechaStr}')" class="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline">
                            Solicitar corrección
                        </button>
                    </td>
                </tr>`;
            }

            if (!filasHtml) {
                filasHtml = `<tr><td colspan="4" class="text-center py-6 text-slate-400">Sin registros aún en este periodo.</td></tr>`;
            }
            tbody.innerHTML = filasHtml;
        }

        function seleccionarDiaParaCorregir(fechaStr) {
            toggleModuloCorreccion(true);
            const inputFecha = document.getElementById('corr-fecha');
            inputFecha.value = fechaStr;
            actualizarPreviewCorreccion();
            document.getElementById('seccion-correccion').scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById('corr-motivo').focus();
        }

        function obtenerSegundosRegistradosEnFecha(fechaStr) {
            if (!fechaStr || !datosMensualesAgente) return 0;
            const partesFecha = fechaStr.split("-");
            const partesMes = datosMensualesAgente.mes.split("/");
            if (parseInt(partesFecha[0], 10) === parseInt(partesMes[1], 10) &&
                parseInt(partesFecha[1], 10) === parseInt(partesMes[0], 10)) {
                const dia = parseInt(partesFecha[2], 10);
                return (datosMensualesAgente.resumen.dias && datosMensualesAgente.resumen.dias[dia]) || 0;
            }
            return 0;
        }

        function actualizarPreviewCorreccion() {
            const fecha = document.getElementById('corr-fecha').value;
            const tipo = document.getElementById('corr-tipo').value;
            const h = Math.max(0, parseInt(document.getElementById('corr-horas').value || 0, 10));
            const m = Math.max(0, Math.min(59, parseInt(document.getElementById('corr-minutos').value || 0, 10)));
            const segsInput = (h * 3600) + (m * 60);

            const lbl = document.getElementById('lbl-corr-tiempo');
            if (tipo === 'sumar') lbl.textContent = "Sumar (HH : MM)";
            if (tipo === 'restar') lbl.textContent = "Restar (HH : MM)";
            if (tipo === 'fijar') lbl.textContent = "Total Día (HH : MM)";

            const previewTxt = document.getElementById('corr-preview-txt');
            if (!fecha) {
                previewTxt.textContent = "Selecciona una fecha.";
                return;
            }

            const actuales = obtenerSegundosRegistradosEnFecha(fecha);
            let nuevoTotal = actuales;
            let delta = 0;

            if (tipo === 'sumar') {
                delta = segsInput;
                nuevoTotal = actuales + segsInput;
            } else if (tipo === 'restar') {
                delta = -segsInput;
                nuevoTotal = Math.max(0, actuales - segsInput);
            } else if (tipo === 'fijar') {
                delta = segsInput - actuales;
                nuevoTotal = segsInput;
            }

            const signo = delta >= 0 ? "+" : "-";
            previewTxt.innerHTML = `Día <b>${fecha.split('-').reverse().join('/')}</b>: <span class="font-mono">${formatoHMS(actuales)}</span> → <b class="font-mono">${formatoHMS(nuevoTotal)}</b> (<span class="font-mono font-bold">${signo}${formatoHMS(Math.abs(delta))}</span>)`;
        }

        async function enviarSolicitudCorreccion() {
            const fecha = document.getElementById('corr-fecha').value;
            const tipo = document.getElementById('corr-tipo').value;
            const h = Math.max(0, parseInt(document.getElementById('corr-horas').value || 0, 10));
            const m = Math.max(0, Math.min(59, parseInt(document.getElementById('corr-minutos').value || 0, 10)));
            const segundos = (h * 3600) + (m * 60);
            const motivo = document.getElementById('corr-motivo').value.trim();

            if (!fecha) {
                showToast("Selecciona el día que deseas corregir.");
                return;
            }
            if ((tipo === 'sumar' || tipo === 'restar') && segundos <= 0) {
                showToast("Indica una cantidad de horas o minutos mayor a cero.");
                return;
            }
            if (!motivo) {
                showToast("Escribe el motivo de la corrección para el supervisor.");
                document.getElementById('corr-motivo').focus();
                return;
            }

            document.getElementById('loading-overlay').classList.remove('hidden');
            try {
                await fetchGoogleAPI("crearSolicitudCorreccion", {
                    usuario: usuarioActivo,
                    fecha: fecha,
                    tipo: tipo,
                    segundos: segundos,
                    motivo: motivo
                });
                showToast("Solicitud enviada al supervisor.");
                document.getElementById('corr-motivo').value = "";
                await cargarDatosMensualesAgente();
            } catch (e) {
                showToast("Error al enviar la solicitud de corrección.");
                console.error(e);
            } finally {
                document.getElementById('loading-overlay').classList.add('hidden');
            }
        }

        async function cancelarMiSolicitud(id) {
            if (!confirm("¿Deseas cancelar y eliminar esta solicitud pendiente?")) return;
            try {
                await fetchGoogleAPI("cancelarSolicitudCorreccion", { id: id, usuario: usuarioActivo });
                showToast("Solicitud cancelada.");
                await cargarDatosMensualesAgente();
            } catch (e) {
                showToast("No se pudo cancelar la solicitud.");
            }
        }

        function renderMisSolicitudes() {
            const wrapper = document.getElementById('contenedor-mis-solicitudes');
            const cont = document.getElementById('lista-mis-solicitudes');
            const badgeCount = document.getElementById('contador-mis-solicitudes');

            if (!solicitudesAgente || solicitudesAgente.length === 0) {
                badgeCount.classList.add('hidden');
                wrapper.classList.add('hidden');
                cont.innerHTML = "";
                return;
            }

            const pendientes = solicitudesAgente.filter(s => s.estado === 'SOLICITUD_PENDIENTE').length;
            badgeCount.textContent = pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : `${solicitudesAgente.length} solic.`;
            badgeCount.classList.remove('hidden');
            wrapper.classList.remove('hidden');

            let html = "";
            solicitudesAgente.slice(0, 10).forEach(s => {
                const fechaBonita = s.fecha ? s.fecha.split('-').reverse().join('/') : '-';
                const signo = s.ajusteSegs >= 0 ? "+" : "-";
                const deltaStr = `${signo}${formatoHMS(Math.abs(s.ajusteSegs))}`;

                let estadoBadge = "";
                let btnCancelar = "";
                if (s.estado === 'SOLICITUD_PENDIENTE') {
                    estadoBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">⏳ Pendiente</span>`;
                    btnCancelar = `<button onclick="cancelarMiSolicitud('${s.id}')" class="text-[10px] font-bold text-red-500 hover:underline ml-2">Cancelar</button>`;
                } else if (s.estado === 'SOLICITUD_APROBADA') {
                    estadoBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">✅ Aprobada</span>`;
                } else if (s.estado === 'SOLICITUD_RECHAZADA') {
                    estadoBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">❌ Rechazada</span>`;
                }

                const notaAdmin = s.comentarioAdmin ? ` · <span class="text-slate-500">💬 ${s.comentarioAdmin}</span>` : "";

                html += `<div class="bg-white px-3 py-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                    <div class="truncate">
                        <span class="font-bold text-slate-700">${fechaBonita}</span>
                        <span class="font-mono font-bold ml-1.5 ${s.ajusteSegs >= 0 ? 'text-green-600' : 'text-amber-600'}">${deltaStr}</span>
                        <span class="text-slate-400 ml-1.5 italic">${s.motivo || ''}</span>
                        ${notaAdmin}
                    </div>
                    <div class="flex items-center shrink-0">
                        ${estadoBadge}
                        ${btnCancelar}
                    </div>
                </div>`;
            });
            cont.innerHTML = html;
        }

        async function cambiarEstadoUI(nuevoEstado) {
            if (nuevoEstado === estadoApp) return;
            document.getElementById('loading-overlay').classList.remove('hidden');
            const act = document.getElementById('input-actividad').value.trim();
            
            try {
                await fetchGoogleAPI("setEstado", { usuario: usuarioActivo, estado: nuevoEstado, actividad: act });
                showToast(`Estado cambiado a: ${nuevoEstado}`);
                
                let horaOpt = "-";
                if (nuevoEstado === 'Conectado') {
                    const now = getHoraActualMadridAsLocal();
                    horaOpt = (now.getHours()<10?'0':'') + now.getHours() + ':' + 
                              (now.getMinutes()<10?'0':'') + now.getMinutes() + ':' + 
                              (now.getSeconds()<10?'0':'') + now.getSeconds();
                }
                aplicarEstadoLocal(nuevoEstado, horaOpt, act);
                
                refrescarDatosBackend();
                cargarDatosMensualesAgente();
            } catch (error) {
                showToast("Error al cambiar estado.", false);
            } finally {
                document.getElementById('loading-overlay').classList.add('hidden');
            }
        }

        async function actualizarActividad() {
            const act = document.getElementById('input-actividad').value.trim();
            if(!act) return;
            try {
                await fetchGoogleAPI("setEstado", { usuario: usuarioActivo, estado: estadoApp, actividad: act });
                showToast("Tarea fijada correctamente.");
            } catch (error) { showToast("Error al fijar tarea."); }
        }

        function enviarLatidoActivo() {
            if (estadoApp !== "Desconectado") {
                fetchGoogleAPI("heartbeat", { usuario: usuarioActivo }).catch(() => {});
            }
        }

        function iniciarLatidos() {
            // Usamos un Web Worker en línea para que el navegador NUNCA congele el latido cuando la pestaña está minimizada,
            // pero muera en el acto si se cierra la ventana/pestaña.
            try {
                const blob = new Blob([`setInterval(() => postMessage('tick'), 45000);`], { type: 'application/javascript' });
                heartbeatWorker = new Worker(URL.createObjectURL(blob));
                heartbeatWorker.onmessage = () => enviarLatidoActivo();
            } catch (e) {
                latidoTimer = setInterval(enviarLatidoActivo, 45000);
            }

            // Al cerrar la pestaña o cambiar visibilidad, sellamos la marca de tiempo exacta del último segundo activo
            window.addEventListener('pagehide', () => {
                if (estadoApp !== "Desconectado" && typeof enviarUltimoLatidoKeepalive === 'function') {
                    enviarUltimoLatidoKeepalive(usuarioActivo);
                }
            });
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    enviarLatidoActivo();
                } else if (estadoApp !== "Desconectado" && typeof enviarUltimoLatidoKeepalive === 'function') {
                    enviarUltimoLatidoKeepalive(usuarioActivo);
                }
            });
            
            if (typeof supabaseClient !== 'undefined') {
                supabaseClient
                    .channel('estado_agente_' + usuarioActivo)
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'estado_vivo', filter: 'usuario=eq.' + usuarioActivo }, payload => {
                        const nuevoEstado = payload.new;
                        if (nuevoEstado.estado === 'Desconectado' && estadoApp !== 'Desconectado') {
                            if (cronometroVirtual) clearInterval(cronometroVirtual);
                            document.getElementById('tiempo-real-txt').textContent = "00:00:00";
                            
                            estadoApp = 'Desconectado';
                            document.getElementById('texto-estado').textContent = "Desconectado (por Admin)";
                            document.getElementById('texto-hora-inicio').textContent = "Jornada detenida por el administrador.";
                            document.querySelectorAll('.state-btn').forEach(b => b.classList.remove('active-work','active-break','active-pause','active-off'));
                            document.getElementById('btn-off').classList.add('active-off');
                            
                            localStorage.setItem('tt_estado', 'Desconectado');
                            alert("⚠️ El administrador ha cerrado tu sesión remotamente.");
                        }
                    })
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maestro', filter: 'usuario=eq.' + usuarioActivo }, payload => {
                        const row = payload.new;
                        if (row && (row.estado === 'SOLICITUD_APROBADA' || row.estado === 'SOLICITUD_RECHAZADA')) {
                            showToast(row.estado === 'SOLICITUD_APROBADA' ? "✅ Tu solicitud de corrección fue aprobada." : "❌ Tu solicitud de corrección fue rechazada.");
                            refrescarDatosBackend();
                            cargarDatosMensualesAgente();
                        }
                    })
                    .subscribe();
            }
        }

        function aplicarEstadoLocal(estado, horaInicioStr, actividad) {
            estadoApp = estado;
            document.getElementById('texto-estado').textContent = estado;
            document.getElementById('texto-hora-inicio').textContent = (horaInicioStr !== "-") ? `Desde las ${horaInicioStr}` : "Jornada detenida.";
            document.getElementById('input-actividad').value = actividad;
            let txtTarea = document.getElementById('texto-tarea');
            if(txtTarea) txtTarea.textContent = actividad ? `📌 ${actividad}` : ``;

            document.querySelectorAll('.state-btn').forEach(b => b.classList.remove('active-work','active-break','active-pause','active-off'));
            
            let colorBorder = "#94a3b8"; 
            if (estado === 'Conectado') { document.getElementById('btn-work').classList.add('active-work'); colorBorder = "#16a34a"; }
            if (estado === 'Descanso') { document.getElementById('btn-break').classList.add('active-break'); colorBorder = "#2563eb"; }
            if (estado === 'Pausado') { document.getElementById('btn-pause').classList.add('active-pause'); colorBorder = "#d97706"; }
            if (estado === 'Desconectado') { document.getElementById('btn-off').classList.add('active-off'); }

            document.getElementById('tarjeta-estado').style.borderLeftColor = colorBorder;
            document.getElementById('icono-estado-mini').style.backgroundColor = colorBorder;

            if (cronometroVirtual) {
                clearInterval(cronometroVirtual);
                cronometroVirtual = null;
            }
            
            if (horaInicioStr !== "-" && estado === "Conectado") {
                try {
                    const parts = horaInicioStr.split(" ");
                    if(parts.length === 2) {
                        const dateParts = parts[0].split("/");
                        const timeParts = parts[1].split(":");
                        horaInicioGlobal = new Date(
                            parseInt(dateParts[2]), 
                            parseInt(dateParts[1]) - 1, 
                            parseInt(dateParts[0]), 
                            parseInt(timeParts[0]), 
                            parseInt(timeParts[1]), 
                            parseInt(timeParts[2])
                        );
                    } else if (parts.length === 1) {
                        const timeParts = parts[0].split(":");
                        horaInicioGlobal = getHoraActualMadridAsLocal();
                        horaInicioGlobal.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2] || 0), 0);
                    }
                    cronometroVirtual = setInterval(ticTacCronometro, 1000);
                } catch(e) {
                    horaInicioGlobal = null;
                }
            } else {
                horaInicioGlobal = null;
            }
            
            ticTacCronometro();
        }

        function ticTacCronometro() {
            try {
                let segundosSesionActual = 0;
                
                if (horaInicioGlobal && estadoApp === 'Conectado') {
                    const ahoraMadrid = getHoraActualMadridAsLocal();
                    const diffMs = ahoraMadrid.getTime() - horaInicioGlobal.getTime();
                    if (diffMs > 0) {
                        segundosSesionActual = Math.floor(diffMs / 1000);
                    }
                }

                let totalSegundosDelDia = baseSegundosDiarios + segundosSesionActual;
                const timeStr = formatoHMS(totalSegundosDelDia);
                
                document.getElementById('tiempo-real-txt').textContent = timeStr;

                let objetivoSeguro = (objetivoSegundos && objetivoSegundos > 0) ? objetivoSegundos : (8*3600);
                let porcentaje = Math.min((totalSegundosDelDia / objetivoSeguro) * 100, 100);
                
                let barra = document.getElementById('barra-progreso');
                let msg = document.getElementById('mensaje-progreso');
                let textoReloj = document.getElementById('tiempo-real-txt');

                if (barra && msg && textoReloj) {
                    if (totalSegundosDelDia >= objetivoSeguro) {
                        barra.style.width = "100%";
                        barra.classList.add('progress-overtime');
                        textoReloj.style.color = "#d97706";
                        msg.textContent = "Jornada completada. Horas extra en curso.";
                        msg.style.color = "#d97706";
                        
                        if (!overtimeAvisado && estadoApp !== 'Desconectado') {
                            showToast("¡Objetivo cumplido! Has superado tu meta de hoy.", true);
                            overtimeAvisado = true;
                        }
                    } else {
                        barra.style.width = `${porcentaje}%`;
                        barra.classList.remove('progress-overtime');
                        textoReloj.style.color = "#1d4ed8";
                        msg.textContent = estadoApp === 'Conectado' ? "Construyendo tu jornada..." : "Reloj detenido.";
                        msg.style.color = "#64748b";
                        overtimeAvisado = false;
                    }
                }
            } catch (error) {
                console.error("Error en renderizado visual:", error);
            }
        }
    </script>
</body>
</html>
