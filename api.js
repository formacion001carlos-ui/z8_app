// api.js

const SUPABASE_URL = "https://owjddgjnqhwvyoafhakm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1o-mFgTMNbTvQiXuQ8JIJg_9O7u8inj";

// Cliente REST nativo de respaldo por si el CDN de Supabase (jsdelivr) es bloqueado por la operadora/navegador
function crearClienteSupabaseRESTNativo(baseUrl, apiKey) {
    function crearQueryBuilder(tabla) {
        const state = {
            method: 'GET',
            selectCols: '*',
            filters: [],
            orders: [],
            limitNum: null,
            bodyData: null,
            preferHeaders: [],
            wantSingle: false,
            wantMaybeSingle: false
        };

        const builder = {
            select(cols = '*') {
                state.selectCols = cols || '*';
                if (state.method !== ' GET' && state.method !== 'GET') {
                    if (!state.preferHeaders.includes('return=representation')) {
                        state.preferHeaders.push('return=representation');
                    }
                }
                return builder;
            },
            insert(payload) {
                state.method = 'POST';
                state.bodyData = payload;
                return builder;
            },
            update(payload) {
                state.method = 'PATCH';
                state.bodyData = payload;
                return builder;
            },
            upsert(payload) {
                state.method = 'POST';
                state.bodyData = payload;
                if (!state.preferHeaders.includes('resolution=merge-duplicates')) {
                    state.preferHeaders.push('resolution=merge-duplicates');
                }
                return builder;
            },
            delete() {
                state.method = 'DELETE';
                return builder;
            },
            eq(col, val) {
                state.filters.push(`${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`);
                return builder;
            },
            gte(col, val) {
                state.filters.push(`${encodeURIComponent(col)}=gte.${encodeURIComponent(val)}`);
                return builder;
            },
            lte(col, val) {
                state.filters.push(`${encodeURIComponent(col)}=lte.${encodeURIComponent(val)}`);
                return builder;
            },
            order(col, opts = {}) {
                const dir = opts.ascending === false ? 'desc' : 'asc';
                state.orders.push(`${encodeURIComponent(col)}.${dir}`);
                return builder;
            },
            limit(n) {
                state.limitNum = n;
                return builder;
            },
            single() {
                state.wantSingle = true;
                state.limitNum = 1;
                return builder;
            },
            maybeSingle() {
                state.wantMaybeSingle = true;
                state.limitNum = 1;
                return builder;
            },
            async _exec() {
                try {
                    const params = [];
                    if (state.selectCols) params.push(`select=${encodeURIComponent(state.selectCols)}`);
                    params.push(...state.filters);
                    if (state.orders.length > 0) params.push(`order=${state.orders.join(',')}`);
                    if (state.limitNum !== null) params.push(`limit=${state.limitNum}`);
                    const qs = params.length > 0 ? `?${params.join('&')}` : '';
                    const headers = {
                        'apikey': apiKey,
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    };
                    if (state.preferHeaders.length > 0) {
                        headers['Prefer'] = state.preferHeaders.join(',');
                    }
                    const resp = await fetch(`${baseUrl}/rest/v1/${tabla}${qs}`, {
                        method: state.method,
                        headers,
                        body: state.bodyData !== null ? JSON.stringify(state.bodyData) : undefined
                    });
                    if (!resp.ok) {
                        const errTxt = await resp.text();
                        return { data: null, error: { message: errTxt || `HTTP ${resp.status}`, status: resp.status } };
                    }
                    const text = await resp.text();
                    let parsed = text ? JSON.parse(text) : null;
                    if (state.wantSingle) {
                        if (Array.isArray(parsed)) {
                            if (parsed.length === 0) return { data: null, error: { message: 'No rows found' } };
                            return { data: parsed[0], error: null };
                        }
                    } else if (state.wantMaybeSingle) {
                        if (Array.isArray(parsed)) {
                            return { data: parsed.length > 0 ? parsed[0] : null, error: null };
                        }
                    }
                    return { data: parsed, error: null };
                } catch (err) {
                    return { data: null, error: err };
                }
            },
            then(onFulfilled, onRejected) {
                return builder._exec().then(onFulfilled, onRejected);
            }
        };
        return builder;
    }

    return {
        from(tabla) { return crearQueryBuilder(tabla); },
        channel() {
            const dummyChannel = {
                on() { return dummyChannel; },
                subscribe(cb) { if (typeof cb === 'function') setTimeout(() => cb('SUBSCRIBED'), 10); return dummyChannel; },
                send: async () => ({ status: 'ok' })
            };
            return dummyChannel;
        }
    };
}

const supabaseClient = (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function')
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : crearClienteSupabaseRESTNativo(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache local de perfiles para avatares rápidos
window._cachePerfilesZ8 = {};

async function fetchGoogleAPI(action, payload = {}) {
    if (action === "login") {
        const usr = (payload.usuario || "").trim().toUpperCase();
        const pwd = (payload.password || "").trim();

        try {
            const { data, error } = await supabaseClient
                .from('usuarios')
                .select('rol')
                .eq('nombre', usr)
                .eq('clave', pwd)
                .single();

            if (!error && data) {
                return { valido: true, rol: data.rol };
            }
        } catch (e) {}

        // Respaldo directo por REST nativo si el cliente principal dio error de red/CDN
        const urlDirecta = `${SUPABASE_URL}/rest/v1/usuarios?select=rol&nombre=eq.${encodeURIComponent(usr)}&clave=eq.${encodeURIComponent(pwd)}&limit=1`;
        const resp = await fetch(urlDirecta, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const rows = await resp.json();
        if (!rows || rows.length === 0) return { valido: false };
        return { valido: true, rol: rows[0].rol };
    }
    
    if (action === "forceDisconnect") {
        payload.estado = "Desconectado";
        payload.actividad = "";
        action = "setEstado";
    }

    if (action === "setEstado" || action === "registrarFichaje") {
        const usr = (payload.usuario || "").trim().toUpperCase();
        const { data: vivo } = await supabaseClient
            .from('estado_vivo')
            .select('*')
            .eq('usuario', usr)
            .single();
            
        if (vivo && vivo.estado !== "Desconectado") {
            await supabaseClient.from('maestro').insert({
                usuario: usr,
                estado: vivo.estado,
                actividad: vivo.actividad,
                inicio: vivo.inicio,
                fin: new Date().toISOString()
            });
        }
        
        if (payload.estado === "Desconectado") {
            await supabaseClient.from('estado_vivo').upsert({
                usuario: usr,
                estado: payload.estado,
                actividad: "",
                inicio: null,
                actualizado_en: new Date().toISOString()
            });
        } else {
            await supabaseClient.from('estado_vivo').upsert({
                usuario: usr,
                estado: payload.estado,
                actividad: payload.actividad,
                inicio: new Date().toISOString(),
                actualizado_en: new Date().toISOString()
            });
        }
        return { success: true };
    }
    
    if (action === "getEstado") {
        const usr = (payload.usuario || "").trim().toUpperCase();
        const { data: vivo } = await supabaseClient
            .from('estado_vivo')
            .select('*')
            .eq('usuario', usr)
            .single();
            
        const { data: userData } = await supabaseClient
            .from('usuarios')
            .select('horas_objetivo')
            .eq('nombre', usr)
            .single();
        let target = userData ? userData.horas_objetivo : 8;
            
        const ahora = new Date();
        const hoyStr = ahora.toISOString().split('T')[0];
        const inicioDia = new Date(hoyStr + "T00:00:00Z").toISOString();
        const finDia = new Date(hoyStr + "T23:59:59Z").toISOString();
        
        const { data: fichajesHoy } = await supabaseClient.from('maestro')
            .select('*')
            .eq('usuario', usr)
            .gte('inicio', inicioDia)
            .lte('inicio', finDia);
            
        let segundosHoy = calcularSegundosListaFichajes(fichajesHoy);
        
        if (!vivo || vivo.estado === 'Desconectado') {
            return {
                estado: 'Desconectado',
                actividad: '',
                inicio: '-',
                segundosAcumuladosHoy: segundosHoy,
                horasObjetivo: target
            };
        }
        
        let di = new Date(vivo.inicio);
        let str = di.toLocaleString("en-US", { timeZone: "Europe/Madrid", hour12: false });
        let timePart = str.split(", ")[1].trim();
        let parts = timePart.split(":");
        let h = parseInt(parts[0]);
        if (h === 24) h = 0;
        let hh = String(h).padStart(2, '0');
        let mm = String(parts[1]).padStart(2, '0');
        let ss = String(parts[2]).padStart(2, '0');
        let inicioStr = `${hh}:${mm}:${ss}`;
        
        return {
            estado: vivo.estado,
            actividad: vivo.actividad || '',
            inicio: inicioStr,
            horaInicio: inicioStr,
            segundosAcumuladosHoy: segundosHoy,
            horasObjetivo: target
        };
    }
    
    if (action === "registroManual") {
        let usr = (payload.usuario || "").trim().toUpperCase();
        let partsD = payload.fecha.split("/");
        let strIni = `${partsD[2]}-${partsD[1]}-${partsD[0]}T${payload.inicio}Z`;
        let strFin = `${partsD[2]}-${partsD[1]}-${partsD[0]}T${payload.fin}Z`;
        
        let dIni = new Date(strIni).toISOString();
        let dFin = new Date(strFin).toISOString();
        
        const { data: exist } = await supabaseClient.from('maestro')
            .select('*')
            .eq('usuario', usr)
            .gte('inicio', dIni.substring(0, 10) + 'T00:00:00Z')
            .lte('inicio', dIni.substring(0, 10) + 'T23:59:59Z');
            
        let overlap = false;
        if (exist) {
            for (let r of exist) {
                if (r.inicio === dIni && r.fin === dFin) overlap = true;
            }
        }
        
        if (!overlap) {
            await supabaseClient.from('maestro').insert({
                usuario: usr,
                estado: "Carga Manual",
                actividad: payload.actividad,
                inicio: dIni,
                fin: dFin
            });
        }
        return { success: true };
    }
    
    if (action === "getAdminData") {
        const ahora = new Date();
        const hoyStr = ahora.toISOString().split('T')[0];
        const inicioDia = new Date(hoyStr + "T00:00:00Z").toISOString();
        const finDia = new Date(hoyStr + "T23:59:59Z").toISOString();
        
        const [{ data: vivos }, { data: fichajesHoy }, mapaPerfiles] = await Promise.all([
            supabaseClient.from('estado_vivo').select('*'),
            supabaseClient.from('maestro').select('*').gte('inicio', inicioDia).lte('inicio', finDia),
            fetchGoogleAPI("getPerfilesUsuarios", {})
        ]);
            
        let arr = [];
        if (vivos) {
            for (let v of vivos) {
                let userFichajes = fichajesHoy ? fichajesHoy.filter(f => f.usuario === v.usuario) : [];
                let horasHoySecs = calcularSegundosListaFichajes(userFichajes);
                
                let h = Math.floor(horasHoySecs / 3600);
                let m = Math.floor((horasHoySecs % 3600) / 60);
                let s = horasHoySecs % 60;
                let horasHoyStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                let inicioStr = "-";
                if (v.inicio) {
                    let di = new Date(v.inicio);
                    let str = di.toLocaleString("en-US", { timeZone: "Europe/Madrid", hour12: false });
                    let parts = str.split(", ");
                    let dateParts = parts[0].split("/");
                    let timeParts = parts[1].trim().split(":");
                    
                    let h = parseInt(timeParts[0]);
                    if (h === 24) h = 0;
                    
                    let dia = String(dateParts[1]).padStart(2, '0');
                    let mes = String(dateParts[0]).padStart(2, '0');
                    let ano = dateParts[2];
                    let hh = String(h).padStart(2, '0');
                    let mm = String(timeParts[1]).padStart(2, '0');
                    let ss = String(timeParts[2]).padStart(2, '0');
                    inicioStr = `${dia}/${mes}/${ano} ${hh}:${mm}:${ss}`;
                }
                
                const p = (mapaPerfiles && mapaPerfiles[v.usuario]) ? mapaPerfiles[v.usuario] : {};
                arr.push({
                    usuario: v.usuario,
                    estado: v.estado,
                    actividad: v.actividad || "-",
                    inicio: inicioStr,
                    horaInicio: inicioStr,
                    horasHoy: horasHoyStr,
                    perfil: p
                });
            }
        }
        return arr;
    }
    
    if (action === "getMonthlySummary") {
        let ano, mes;
        if (payload.month) {
            const parts = payload.month.split('-');
            ano = parseInt(parts[0], 10);
            mes = parseInt(parts[1], 10) - 1;
        } else {
            const ahora = new Date();
            ano = ahora.getFullYear();
            mes = ahora.getMonth();
        }
        
        const primerDia = new Date(Date.UTC(ano, mes, 1, 0, 0, 0)).toISOString();
        const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0, 23, 59, 59)).toISOString();
        
        const { data: fichajes } = await supabaseClient
            .from('maestro')
            .select('*')
            .gte('inicio', primerDia)
            .lte('inicio', ultimoDia);
            
        const { data: usuarios } = await supabaseClient
            .from('usuarios')
            .select('*');
            
        let metas = {};
        if (usuarios) {
            for (let u of usuarios) {
                metas[u.nombre] = u.horas_objetivo || 8;
            }
        }
        
        let diasLaborables = 0;
        let d = new Date(ano, mes, 1);
        while (d.getMonth() === mes) {
            let day = d.getDay();
            if (day !== 0 && day !== 6) diasLaborables++;
            d.setDate(d.getDate() + 1);
        }
        
        let matriz = {};
        for (let u in metas) {
            matriz[u] = {
                totalMes: 0,
                dias: {},
                ajustesAprobados: {},
                previstas: metas[u] * diasLaborables * 3600,
                horasObjetivoDiarias: metas[u],
                horasLaborables: 0,
                horasFinde: 0
            };
        }
        
        if (fichajes) {
            for (let f of fichajes) {
                let usr = f.usuario;
                if (!matriz[usr]) continue;
                if (esFilaSistemaNoComputable(f.estado)) continue;
                
                let segs = obtenerSegundosDeFilaMaestro(f);
                if (segs === 0) continue;
                
                let dIni = new Date(f.inicio);
                let diaDelMes = dIni.getUTCDate();
                matriz[usr].dias[diaDelMes] = (matriz[usr].dias[diaDelMes] || 0) + segs;
                
                if (f.estado === 'SOLICITUD_APROBADA') {
                    matriz[usr].ajustesAprobados[diaDelMes] = (matriz[usr].ajustesAprobados[diaDelMes] || 0) + segs;
                }
            }
        }
        
        for (let u in matriz) {
            let totalM = 0;
            let labM = 0;
            let findeM = 0;
            for (let diaStr in matriz[u].dias) {
                let diaNum = parseInt(diaStr, 10);
                let segsDia = Math.max(0, matriz[u].dias[diaNum]);
                matriz[u].dias[diaNum] = segsDia;
                if (segsDia === 0) {
                    delete matriz[u].dias[diaNum];
                    continue;
                }
                totalM += segsDia;
                let fechaDia = new Date(Date.UTC(ano, mes, diaNum));
                let diaSemana = fechaDia.getUTCDay();
                if (diaSemana === 0 || diaSemana === 6) {
                    findeM += segsDia;
                } else {
                    labM += segsDia;
                }
            }
            matriz[u].totalMes = totalM;
            matriz[u].horasLaborables = labM;
            matriz[u].horasFinde = findeM;
        }
        
        return {
            mes: `${(mes+1).toString().padStart(2,'0')}/${ano}`,
            datos: matriz
        };
    }

    if (action === "getAgentMonthlyData") {
        const usr = (payload.usuario || "").trim().toUpperCase();
        const summary = await fetchGoogleAPI("getMonthlySummary", { month: payload.month });
        const userStats = (summary.datos && summary.datos[usr]) ? summary.datos[usr] : {
            totalMes: 0,
            dias: {},
            ajustesAprobados: {},
            previstas: 8 * 22 * 3600,
            horasObjetivoDiarias: 8,
            horasLaborables: 0,
            horasFinde: 0
        };

        const { data: rowsSol } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('usuario', usr)
            .in('estado', ['SOLICITUD_PENDIENTE', 'SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA'])
            .order('inicio', { ascending: false });

        const solicitudes = (rowsSol || []).map(formatearFilaSolicitud);

        return {
            mes: summary.mes,
            resumen: userStats,
            solicitudes: solicitudes
        };
    }

    if (action === "crearSolicitudCorreccion") {
        const usr = (payload.usuario || "").trim().toUpperCase();
        const fecha = payload.fecha;
        const tipo = payload.tipo;
        const tiempoSolicitadoSegs = Math.max(0, parseInt(payload.segundos || 0, 10));
        const motivo = (payload.motivo || "").trim();

        if (!usr || !fecha || !motivo) {
            throw new Error("Datos incompletos para la solicitud.");
        }

        const inicioDia = `${fecha}T00:00:00.000Z`;
        const finDia = `${fecha}T23:59:59.999Z`;
        const { data: fichajesDia } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('usuario', usr)
            .gte('inicio', inicioDia)
            .lte('inicio', finDia);

        const horasActualesDiaSegs = calcularSegundosListaFichajes(fichajesDia || []);

        let ajusteSegs = 0;
        if (tipo === 'sumar') {
            ajusteSegs = tiempoSolicitadoSegs;
        } else if (tipo === 'restar') {
            ajusteSegs = -tiempoSolicitadoSegs;
        } else if (tipo === 'fijar') {
            ajusteSegs = tiempoSolicitadoSegs - horasActualesDiaSegs;
        }

        const meta = {
            fecha: fecha,
            tipo: tipo,
            tiempoSolicitadoSegs: tiempoSolicitadoSegs,
            horasActualesDiaSegs: horasActualesDiaSegs,
            ajusteSegs: ajusteSegs,
            motivo: motivo,
            creadoEn: new Date().toISOString(),
            resueltoEn: null,
            comentarioAdmin: ""
        };

        const { data: inserted, error } = await supabaseClient
            .from('maestro')
            .insert({
                usuario: usr,
                estado: 'SOLICITUD_PENDIENTE',
                actividad: JSON.stringify(meta),
                inicio: `${fecha}T12:00:00.000Z`,
                fin: null,
                duracion_segundos: ajusteSegs
            })
            .select();

        if (error) throw error;
        return { success: true, solicitud: inserted ? formatearFilaSolicitud(inserted[0]) : null };
    }

    if (action === "cancelarSolicitudCorreccion") {
        const id = payload.id;
        const usr = (payload.usuario || "").trim().toUpperCase();
        const { error } = await supabaseClient
            .from('maestro')
            .delete()
            .eq('id', id)
            .eq('usuario', usr)
            .eq('estado', 'SOLICITUD_PENDIENTE');
        if (error) throw error;
        return { success: true };
    }

    if (action === "getSolicitudesAdmin") {
        const { data: rowsSol, error } = await supabaseClient
            .from('maestro')
            .select('*')
            .in('estado', ['SOLICITUD_PENDIENTE', 'SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA'])
            .order('inicio', { ascending: false });

        if (error) throw error;
        const solicitudes = (rowsSol || []).map(formatearFilaSolicitud);
        solicitudes.sort((a, b) => {
            if (a.estado === 'SOLICITUD_PENDIENTE' && b.estado !== 'SOLICITUD_PENDIENTE') return -1;
            if (a.estado !== 'SOLICITUD_PENDIENTE' && b.estado === 'SOLICITUD_PENDIENTE') return 1;
            return (b.creadoEn || '').localeCompare(a.creadoEn || '');
        });
        return solicitudes;
    }

    if (action === "resolverSolicitudAdmin") {
        const id = payload.id;
        const decision = payload.decision;
        const comentarioAdmin = (payload.comentarioAdmin || "").trim();

        if (decision === 'ELIMINAR') {
            const { error } = await supabaseClient.from('maestro').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        }

        const { data: row, error: fetchErr } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchErr || !row) throw new Error("No se encontró la solicitud.");

        const sol = formatearFilaSolicitud(row);
        const fecha = sol.fecha;

        const inicioDia = `${fecha}T00:00:00.000Z`;
        const finDia = `${fecha}T23:59:59.999Z`;
        const { data: fichajesDia } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('usuario', row.usuario)
            .gte('inicio', inicioDia)
            .lte('inicio', finDia);

        const otrosFichajes = (fichajesDia || []).filter(f => f.id !== id);
        const horasActualesDiaSegs = calcularSegundosListaFichajes(otrosFichajes);

        let ajusteFinal = sol.ajusteSegs;
        if (sol.tipo === 'sumar') {
            ajusteFinal = sol.tiempoSolicitadoSegs;
        } else if (sol.tipo === 'restar') {
            ajusteFinal = -sol.tiempoSolicitadoSegs;
        } else if (sol.tipo === 'fijar') {
            ajusteFinal = sol.tiempoSolicitadoSegs - horasActualesDiaSegs;
        }

        const nuevoEstado = (decision === 'APROBAR') ? 'SOLICITUD_APROBADA' : 'SOLICITUD_RECHAZADA';
        const nuevaMeta = {
            fecha: sol.fecha,
            tipo: sol.tipo,
            tiempoSolicitadoSegs: sol.tiempoSolicitadoSegs,
            horasActualesDiaSegs: horasActualesDiaSegs,
            ajusteSegs: ajusteFinal,
            motivo: sol.motivo,
            creadoEn: sol.creadoEn,
            resueltoEn: new Date().toISOString(),
            comentarioAdmin: comentarioAdmin
        };

        const { error: updErr } = await supabaseClient
            .from('maestro')
            .update({
                estado: nuevoEstado,
                duracion_segundos: ajusteFinal,
                actividad: JSON.stringify(nuevaMeta)
            })
            .eq('id', id);

        if (updErr) throw updErr;
        return { success: true };
    }
    
    if (action === "heartbeat") {
        await supabaseClient.from('estado_vivo')
            .update({ actualizado_en: new Date().toISOString() })
            .eq('usuario', (payload.usuario || "").trim().toUpperCase());
        return { success: true };
    }

    // =========================================================================
    // NUEVOS MÓDULOS: PERFILES, NOTIFICACIONES/ALARMAS, CHAT Y NOTAS DE REUNIÓN
    // =========================================================================

    if (action === "getPerfilesUsuarios") {
        const [{ data: usuariosRows }, { data: perfilesRows }, { data: vivosRows }] = await Promise.all([
            supabaseClient.from('usuarios').select('nombre, rol, horas_objetivo, mattermost, UTC'),
            supabaseClient.from('maestro').select('*').eq('estado', 'PERFIL_USUARIO'),
            supabaseClient.from('estado_vivo').select('usuario, estado')
        ]);

        const estadoVivoMap = {};
        if (vivosRows) {
            for (const v of vivosRows) estadoVivoMap[v.usuario] = v.estado || 'Desconectado';
        }

        const coloresDefault = ['#2563eb', '#059669', '#7c3aed', '#db2777', '#d97706', '#0891b2', '#4f46e5', '#dc2626'];
        const mapa = {};

        if (usuariosRows) {
            usuariosRows.forEach((u, idx) => {
                const usr = (u.nombre || "").trim().toUpperCase();
                if (!usr) return;
                mapa[usr] = {
                    usuario: usr,
                    rol: u.rol || 'agente',
                    horasObjetivo: u.horas_objetivo || 8,
                    mattermost: u.mattermost || '',
                    utc: u.UTC || 'Europe/Madrid',
                    estadoActual: estadoVivoMap[usr] || 'Desconectado',
                    nombreMostrar: usr,
                    correo: '',
                    movil: '',
                    whatsapp: '',
                    servicio: u.rol === 'admin' ? 'Supervisión' : 'General',
                    colorAvatar: coloresDefault[idx % coloresDefault.length],
                    fotoDataUrl: '',
                    temaPreferido: 'auto',
                    setupCompletado: false,
                    rowId: null
                };
            });
        }

        if (perfilesRows) {
            for (const row of perfilesRows) {
                const usr = (row.usuario || "").trim().toUpperCase();
                if (!usr) continue;
                let meta = {};
                try { meta = JSON.parse(row.actividad || '{}'); } catch (e) {}
                if (!mapa[usr]) {
                    mapa[usr] = {
                        usuario: usr,
                        rol: 'agente',
                        horasObjetivo: 8,
                        mattermost: '',
                        estadoActual: estadoVivoMap[usr] || 'Desconectado'
                    };
                }
                mapa[usr] = {
                    ...mapa[usr],
                    nombreMostrar: meta.nombreMostrar || usr,
                    correo: meta.correo || '',
                    movil: meta.movil || '',
                    whatsapp: meta.whatsapp || '',
                    servicio: meta.servicio || mapa[usr].servicio || 'General',
                    mattermost: meta.mattermost || mapa[usr].mattermost || '',
                    colorAvatar: meta.colorAvatar || mapa[usr].colorAvatar || '#2563eb',
                    fotoDataUrl: meta.fotoDataUrl || '',
                    temaPreferido: meta.temaPreferido || 'auto',
                    setupCompletado: Boolean(meta.setupCompletado || (meta.correo && (meta.movil || meta.whatsapp))),
                    rowId: row.id
                };
            }
        }

        window._cachePerfilesZ8 = mapa;
        if (payload.usuario) {
            const u = payload.usuario.trim().toUpperCase();
            return mapa[u] || null;
        }
        return mapa;
    }

    if (action === "guardarPerfilUsuario") {
        const usr = await resolverUsuarioFKMaestro(payload.usuario);
        if (!usr) throw new Error("Usuario inválido.");
        const datos = payload.perfil || {};

        const { data: existentes } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('usuario', usr)
            .eq('estado', 'PERFIL_USUARIO');

        let prevMeta = {};
        let rowId = null;
        if (existentes && existentes.length > 0) {
            rowId = existentes[0].id;
            try { prevMeta = JSON.parse(existentes[0].actividad || '{}'); } catch (e) {}
            if (existentes.length > 1) {
                for (let i = 1; i < existentes.length; i++) {
                    await supabaseClient.from('maestro').delete().eq('id', existentes[i].id);
                }
            }
        }

        const nuevaMeta = {
            ...prevMeta,
            nombreMostrar: (datos.nombreMostrar || usr).trim(),
            correo: (datos.correo || "").trim(),
            movil: (datos.movil || "").trim(),
            whatsapp: (datos.whatsapp || "").trim(),
            servicio: (datos.servicio || prevMeta.servicio || "General").trim(),
            mattermost: (datos.mattermost || "").trim(),
            colorAvatar: datos.colorAvatar || prevMeta.colorAvatar || "#2563eb",
            fotoDataUrl: typeof datos.fotoDataUrl === 'string' ? datos.fotoDataUrl : (prevMeta.fotoDataUrl || ""),
            temaPreferido: datos.temaPreferido || prevMeta.temaPreferido || "auto",
            setupCompletado: true,
            actualizadoEn: new Date().toISOString()
        };

        if (rowId) {
            await supabaseClient
                .from('maestro')
                .update({
                    actividad: JSON.stringify(nuevaMeta),
                    duracion_segundos: 0
                })
                .eq('id', rowId);
        } else {
            await supabaseClient
                .from('maestro')
                .insert({
                    usuario: usr,
                    estado: 'PERFIL_USUARIO',
                    actividad: JSON.stringify(nuevaMeta),
                    inicio: '2000-01-01T00:00:00.000Z',
                    fin: null,
                    duracion_segundos: 0
                });
        }

        const updateUsuarioTabla = {};
        if (datos.mattermost !== undefined) updateUsuarioTabla.mattermost = datos.mattermost.trim();
        if (payload.nuevaClave && payload.nuevaClave.trim().length >= 3) {
            updateUsuarioTabla.clave = payload.nuevaClave.trim();
        }
        if (Object.keys(updateUsuarioTabla).length > 0) {
            await supabaseClient.from('usuarios').update(updateUsuarioTabla).eq('nombre', usr);
        }

        emitirEventoOperativoZ8('perfil_actualizado', { usuario: usr });
        return { success: true, perfil: nuevaMeta };
    }

    if (action === "enviarAlertaSupervision") {
        const emisor = (payload.emisor || "SUPERVISIÓN").trim().toUpperCase();
        const destino = (payload.destino || "TODOS").trim().toUpperCase();
        const tipoAlerta = payload.tipoAlerta || "NOTIFICACION"; // 'ALARMA_ATENCION' | 'NOTIFICACION'
        const prioridad = payload.prioridad || (tipoAlerta === 'ALARMA_ATENCION' ? 'URGENTE' : 'NORMAL');
        const titulo = (payload.titulo || (tipoAlerta === 'ALARMA_ATENCION' ? '🚨 ¡ALARMA DE ATENCIÓN!' : '📢 Aviso de Supervisión')).trim();
        const mensaje = (payload.mensaje || (tipoAlerta === 'ALARMA_ATENCION' ? 'Supervisión solicita tu atención inmediata. Pulsa el botón para confirmar que estás en tu puesto.' : '')).trim();

        const meta = {
            emisor,
            destino,
            tipoAlerta,
            prioridad,
            titulo,
            mensaje,
            creadoEn: new Date().toISOString(),
            acuses: {}
        };

        const usuarioFK = await resolverUsuarioFKMaestro(destino !== 'TODOS' ? destino : emisor);
        const { data: inserted, error } = await supabaseClient
            .from('maestro')
            .insert({
                usuario: usuarioFK,
                estado: 'ALERTA_SUPERVISION',
                actividad: JSON.stringify(meta),
                inicio: '2000-01-04T00:00:00.000Z',
                fin: null,
                duracion_segundos: 0
            })
            .select();

        if (error) throw error;
        const row = inserted && inserted[0] ? formatearFilaAlerta(inserted[0]) : null;
        if (row) {
            await emitirEventoOperativoZ8('nueva_alerta_supervision', row);
        }
        return { success: true, alerta: row };
    }

    if (action === "confirmarAlertaSupervision") {
        const id = payload.alertaId;
        const usr = (payload.usuario || "").trim().toUpperCase();
        const segsResp = Math.max(1, parseInt(payload.segundosRespuesta || 1, 10));

        const { data: row } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('id', id)
            .single();

        if (row) {
            let meta = {};
            try { meta = JSON.parse(row.actividad || '{}'); } catch (e) {}
            if (!meta.acuses) meta.acuses = {};
            meta.acuses[usr] = {
                leidoEn: new Date().toISOString(),
                segundosRespuesta: segsResp
            };
            await supabaseClient
                .from('maestro')
                .update({ actividad: JSON.stringify(meta) })
                .eq('id', id);

            await emitirEventoOperativoZ8('acuse_alerta_supervision', {
                alertaId: id,
                usuario: usr,
                leidoEn: meta.acuses[usr].leidoEn,
                segundosRespuesta: segsResp
            });
        }
        return { success: true };
    }

    if (action === "getAlertasSupervision") {
        const { data: rows, error } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('estado', 'ALERTA_SUPERVISION');

        if (error) throw error;
        const lista = (rows || []).map(formatearFilaAlerta);
        lista.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
        return lista.slice(0, 60);
    }

    if (action === "eliminarAlertaSupervision") {
        await supabaseClient.from('maestro').delete().eq('id', payload.id).eq('estado', 'ALERTA_SUPERVISION');
        return { success: true };
    }

    if (action === "getMensajesChat") {
        const { data: rows, error } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('estado', 'CHAT_MSG');

        if (error) throw error;
        const todos = (rows || []).map(formatearFilaChat);
        todos.sort((a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || ''));

        if (todos.length > 160) {
            const sobrantes = todos.slice(0, todos.length - 120);
            for (const s of sobrantes) {
                supabaseClient.from('maestro').delete().eq('id', s.id).then(() => {}).catch(() => {});
            }
        }
        return todos.slice(-120);
    }

    if (action === "enviarMensajeChat") {
        const emisor = (payload.emisor || "").trim().toUpperCase();
        const rolEmisor = payload.rolEmisor || "agente";
        const destino = (payload.destino || "GENERAL").trim().toUpperCase();
        const texto = (payload.texto || "").trim();
        const gifUrl = (payload.gifUrl || "").trim();

        if (!emisor || (!texto && !gifUrl)) throw new Error("Mensaje vacío.");

        const meta = {
            emisor,
            rolEmisor,
            destino,
            texto,
            gifUrl,
            creadoEn: new Date().toISOString()
        };

        const usuarioFK = await resolverUsuarioFKMaestro(emisor);
        const { data: inserted, error } = await supabaseClient
            .from('maestro')
            .insert({
                usuario: usuarioFK,
                estado: 'CHAT_MSG',
                actividad: JSON.stringify(meta),
                inicio: '2000-01-03T00:00:00.000Z',
                fin: null,
                duracion_segundos: 0
            })
            .select();

        if (error) throw error;
        const msg = inserted && inserted[0] ? formatearFilaChat(inserted[0]) : null;
        if (msg) {
            await emitirEventoOperativoZ8('nuevo_mensaje_chat', msg);
        }
        return { success: true, mensaje: msg };
    }

    if (action === "getNotasReunion") {
        const { data: rows, error } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('estado', 'NOTA_REUNION');

        if (error) throw error;
        const notas = (rows || []).map(formatearFilaNotaReunion);
        notas.sort((a, b) => {
            if (a.resuelto !== b.resuelto) return a.resuelto ? 1 : -1;
            return (b.creadoEn || '').localeCompare(a.creadoEn || '');
        });
        return notas;
    }

    if (action === "crearNotaReunion") {
        const autor = (payload.usuario || "").trim().toUpperCase();
        const rolAutor = payload.rol || "agente";
        const categoria = (payload.categoria || "Operativa").trim();
        const tema = (payload.tema || "").trim();
        if (!autor || !tema) throw new Error("Escribe un tema para la reunión.");

        const meta = {
            autor,
            rolAutor,
            categoria,
            tema,
            resuelto: false,
            resolucion: "",
            creadoEn: new Date().toISOString(),
            resueltoEn: null,
            resueltoPor: null
        };

        const usuarioFK = await resolverUsuarioFKMaestro(autor);
        const { data: inserted, error } = await supabaseClient
            .from('maestro')
            .insert({
                usuario: usuarioFK,
                estado: 'NOTA_REUNION',
                actividad: JSON.stringify(meta),
                inicio: '2000-01-02T00:00:00.000Z',
                fin: null,
                duracion_segundos: 0
            })
            .select();

        if (error) throw error;
        const nota = inserted && inserted[0] ? formatearFilaNotaReunion(inserted[0]) : null;
        await emitirEventoOperativoZ8('cambio_notas_reunion', { accion: 'crear', id: nota ? nota.id : null });
        return { success: true, nota };
    }

    if (action === "actualizarNotaReunion") {
        const id = payload.id;
        const { data: row, error: errFetch } = await supabaseClient
            .from('maestro')
            .select('*')
            .eq('id', id)
            .single();

        if (errFetch || !row) throw new Error("No se encontró el tema de reunión.");
        let meta = {};
        try { meta = JSON.parse(row.actividad || '{}'); } catch (e) {}

        const nuevoResuelto = (typeof payload.resuelto === 'boolean') ? payload.resuelto : Boolean(meta.resuelto);
        const nuevaResolucion = (payload.resolucion !== undefined) ? payload.resolucion.trim() : (meta.resolucion || "");

        const nuevaMeta = {
            ...meta,
            resuelto: nuevoResuelto,
            resolucion: nuevaResolucion,
            resueltoEn: nuevoResuelto ? (meta.resueltoEn || new Date().toISOString()) : null,
            resueltoPor: nuevoResuelto ? (payload.usuarioAdmin || "SUPERVISIÓN") : null
        };

        const { error: updErr } = await supabaseClient
            .from('maestro')
            .update({ actividad: JSON.stringify(nuevaMeta) })
            .eq('id', id);

        if (updErr) throw updErr;
        await emitirEventoOperativoZ8('cambio_notas_reunion', { accion: 'actualizar', id });
        return { success: true };
    }

    if (action === "eliminarNotaReunion") {
        await supabaseClient.from('maestro').delete().eq('id', payload.id).eq('estado', 'NOTA_REUNION');
        await emitirEventoOperativoZ8('cambio_notas_reunion', { accion: 'eliminar', id: payload.id });
        return { success: true };
    }
}

async function resolverUsuarioFKMaestro(candidato) {
    const cand = (candidato || "").trim().toUpperCase();
    const cache = window._cachePerfilesZ8 || {};
    if (cand && cache[cand]) return cand;
    const { data: uRow } = await supabaseClient.from('usuarios').select('nombre').eq('nombre', cand).maybeSingle();
    if (uRow && uRow.nombre) return uRow.nombre;
    if (cache['SUPERVISOR']) return 'SUPERVISOR';
    const { data: firstRows } = await supabaseClient.from('usuarios').select('nombre').limit(1);
    return (firstRows && firstRows[0] && firstRows[0].nombre) ? firstRows[0].nombre : 'SUPERVISOR';
}

function esSolicitudNoAprobada(estado) {
    return estado === 'SOLICITUD_PENDIENTE' || estado === 'SOLICITUD_RECHAZADA';
}

function esFilaSistemaNoComputable(estado) {
    if (!estado) return true;
    return (
        estado === 'SOLICITUD_PENDIENTE' ||
        estado === 'SOLICITUD_RECHAZADA' ||
        estado === 'PERFIL_USUARIO' ||
        estado === 'CHAT_MSG' ||
        estado === 'ALERTA_SUPERVISION' ||
        estado === 'NOTA_REUNION'
    );
}

function obtenerSegundosDeFilaMaestro(f) {
    if (!f) return 0;
    if (esFilaSistemaNoComputable(f.estado)) return 0;
    if (f.estado === 'SOLICITUD_APROBADA') {
        if (typeof f.duracion_segundos === 'number' && !isNaN(f.duracion_segundos)) {
            return f.duracion_segundos;
        }
        try {
            const meta = JSON.parse(f.actividad || '{}');
            return Number(meta.ajusteSegs || 0);
        } catch (e) {
            return 0;
        }
    }
    if (f.fin) {
        let dIni = new Date(f.inicio);
        let dFin = new Date(f.fin);
        let diffSegundos = Math.floor((dFin.getTime() - dIni.getTime()) / 1000);
        if (diffSegundos < 0) diffSegundos += 86400;
        return diffSegundos;
    }
    return 0;
}

function calcularSegundosListaFichajes(lista) {
    if (!lista || !Array.isArray(lista)) return 0;
    let total = 0;
    for (let f of lista) {
        total += obtenerSegundosDeFilaMaestro(f);
    }
    return Math.max(0, total);
}

function formatearFilaSolicitud(row) {
    let meta = {};
    try {
        meta = JSON.parse(row.actividad || '{}');
    } catch (e) {
        meta = { motivo: row.actividad || '' };
    }
    const fecha = meta.fecha || (row.inicio ? row.inicio.substring(0, 10) : '');
    const tipo = meta.tipo || ((row.duracion_segundos || 0) >= 0 ? 'sumar' : 'restar');
    const ajusteSegs = (typeof row.duracion_segundos === 'number') ? row.duracion_segundos : Number(meta.ajusteSegs || 0);
    const tiempoSolicitadoSegs = (typeof meta.tiempoSolicitadoSegs === 'number') ? meta.tiempoSolicitadoSegs : Math.abs(ajusteSegs);

    return {
        id: row.id,
        usuario: row.usuario,
        estado: row.estado,
        fecha: fecha,
        tipo: tipo,
        tiempoSolicitadoSegs: tiempoSolicitadoSegs,
        horasActualesDiaSegs: Number(meta.horasActualesDiaSegs || 0),
        ajusteSegs: ajusteSegs,
        motivo: meta.motivo || '',
        creadoEn: meta.creadoEn || row.inicio,
        resueltoEn: meta.resueltoEn || null,
        comentarioAdmin: meta.comentarioAdmin || ''
    };
}

function formatearFilaAlerta(row) {
    let meta = {};
    try { meta = JSON.parse(row.actividad || '{}'); } catch (e) {}
    return {
        id: row.id,
        emisor: meta.emisor || 'SUPERVISIÓN',
        destino: meta.destino || row.usuario || 'TODOS',
        tipoAlerta: meta.tipoAlerta || 'NOTIFICACION',
        prioridad: meta.prioridad || 'NORMAL',
        titulo: meta.titulo || 'Aviso de Supervisión',
        mensaje: meta.mensaje || '',
        creadoEn: meta.creadoEn || row.inicio,
        acuses: meta.acuses || {}
    };
}

function formatearFilaChat(row) {
    let meta = {};
    try { meta = JSON.parse(row.actividad || '{}'); } catch (e) {}
    return {
        id: row.id,
        emisor: meta.emisor || row.usuario,
        rolEmisor: meta.rolEmisor || 'agente',
        destino: meta.destino || 'GENERAL',
        texto: meta.texto || '',
        gifUrl: meta.gifUrl || '',
        creadoEn: meta.creadoEn || row.inicio
    };
}

function formatearFilaNotaReunion(row) {
    let meta = {};
    try { meta = JSON.parse(row.actividad || '{}'); } catch (e) {}
    return {
        id: row.id,
        autor: meta.autor || row.usuario,
        rolAutor: meta.rolAutor || 'agente',
        categoria: meta.categoria || 'Operativa',
        tema: meta.tema || '',
        resuelto: Boolean(meta.resuelto),
        resolucion: meta.resolucion || '',
        creadoEn: meta.creadoEn || row.inicio,
        resueltoEn: meta.resueltoEn || null,
        resueltoPor: meta.resueltoPor || null
    };
}

// Envía el último latido justo al cerrar la pestaña usando fetch keepalive
function enviarUltimoLatidoKeepalive(usuario) {
    if (!usuario) return;
    const usr = usuario.trim().toUpperCase();
    try {
        fetch(`${SUPABASE_URL}/rest/v1/estado_vivo?usuario=eq.${encodeURIComponent(usr)}`, {
            method: 'PATCH',
            keepalive: true,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ actualizado_en: new Date().toISOString() })
        }).catch(() => {});
    } catch (e) {}
}

// --- SISTEMA DE DETECCIÓN DE NUEVAS VERSIONES ---
let _firmaVersionInicial = null;
let _canalVersionGlobal = null;

async function obtenerFirmaArchivosActuales() {
    const Partes = [];
    const urls = ['api.js', window.location.pathname.split('/').pop() || 'index.html'];
    for (let u of urls) {
        try {
            const resp = await fetch(`${u}?_t=${Date.now()}`, { cache: 'no-store' });
            if (resp.ok) {
                const txt = await resp.text();
                Partes.push(`${u}:${txt.length}:${simpleHashStr(txt)}`);
            }
        } catch (e) {}
    }
    return Partes.join('|');
}

function simpleHashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return h;
}

function mostrarBannerNuevaVersion(mensajeExtra) {
    if (document.getElementById('banner-nueva-version-z8')) return;
    const banner = document.createElement('div');
    banner.id = 'banner-nueva-version-z8';
    banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#1e293b;color:#fff;padding:12px 20px;border-radius:12px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.25);display:flex;align-items:center;gap:14px;border:2px solid #3b82f6;font-family:Inter,sans-serif;max-width:92vw;';
    banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">🚀</span>
            <div>
                <div style="font-weight:700;font-size:13px;color:#fff;">Nueva versión disponible</div>
                <div style="font-size:11px;color:#94a3b8;">${mensajeExtra || 'Se ha publicado una actualización del sistema. Actualiza para estar al día.'}</div>
            </div>
        </div>
        <button onclick="recargarConUltimaVersion()" style="background:#2563eb;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;">
            Actualizar ahora
        </button>
    `;
    document.body.appendChild(banner);
}

function recargarConUltimaVersion() {
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now());
    window.location.replace(url.toString());
}

async function iniciarDetectorVersion() {
    _firmaVersionInicial = await obtenerFirmaArchivosActuales();

    setInterval(async () => {
        const nuevaFirma = await obtenerFirmaArchivosActuales();
        if (_firmaVersionInicial && nuevaFirma && nuevaFirma !== _firmaVersionInicial) {
            mostrarBannerNuevaVersion();
        }
    }, 60000);

    if (typeof supabaseClient !== 'undefined') {
        _canalVersionGlobal = supabaseClient
            .channel('sistema_version_z8')
            .on('broadcast', { event: 'nueva_version' }, payload => {
                const msg = (payload && payload.payload && payload.payload.mensaje) || null;
                mostrarBannerNuevaVersion(msg);
            })
            .subscribe();
    }
}

async function emitirAvisoNuevaVersionATodos() {
    if (!_canalVersionGlobal && typeof supabaseClient !== 'undefined') {
        _canalVersionGlobal = supabaseClient.channel('sistema_version_z8');
        await _canalVersionGlobal.subscribe();
    }
    if (_canalVersionGlobal) {
        await _canalVersionGlobal.send({
            type: 'broadcast',
            event: 'nueva_version',
            payload: { mensaje: 'El supervisor ha desplegado una nueva versión. Pulsa en Actualizar.' }
        });
    }
}

// ============================================================================
// 1. GESTOR DE TEMA CLARO / OSCURO AUTOMÁTICO (SEGÚN NAVEGADOR) + MANUAL
// ============================================================================
function inyectarEstilosGlobalesZ8() {
    if (document.getElementById('estilos-globales-z8')) return;
    const st = document.createElement('style');
    st.id = 'estilos-globales-z8';
    st.textContent = `
        html.dark-mode body { background-color: #0f172a !important; color: #e2e8f0 !important; }
        html.dark-mode .bento-panel,
        html.dark-mode .bento-box { background-color: #1e293b !important; border-color: #334155 !important; color: #f1f5f9 !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4) !important; }
        html.dark-mode h1, html.dark-mode h2, html.dark-mode h3,
        html.dark-mode .text-slate-800, html.dark-mode .text-slate-700, html.dark-mode .text-gray-900, html.dark-mode .text-gray-700 { color: #f1f5f9 !important; }
        html.dark-mode .text-slate-600, html.dark-mode .text-slate-500, html.dark-mode .text-gray-500 { color: #94a3b8 !important; }
        html.dark-mode .bg-white { background-color: #1e293b !important; color: #f1f5f9 !important; }
        html.dark-mode .bg-slate-50, html.dark-mode .bg-slate-50\\/50, html.dark-mode .bg-slate-50\\/30,
        html.dark-mode .bg-slate-100, html.dark-mode .bg-slate-100\\/90 { background-color: #0f172a !important; border-color: #334155 !important; color: #cbd5e1 !important; }
        html.dark-mode .bg-blue-50, html.dark-mode .bg-blue-50\\/60, html.dark-mode .bg-blue-50\\/50, html.dark-mode .bg-blue-50\\/40, html.dark-mode .bg-blue-50\\/30 { background-color: rgba(37, 99, 235, 0.16) !important; border-color: rgba(59, 130, 246, 0.35) !important; }
        html.dark-mode .text-blue-800, html.dark-mode .text-blue-700 { color: #60a5fa !important; }
        html.dark-mode .bg-amber-50, html.dark-mode .bg-amber-50\\/40, html.dark-mode .bg-amber-50\\/30, html.dark-mode .bg-amber-50\\/20 { background-color: rgba(217, 119, 6, 0.14) !important; border-color: rgba(245, 158, 11, 0.3) !important; }
        html.dark-mode table th { background-color: #0f172a !important; border-color: #334155 !important; color: #94a3b8 !important; }
        html.dark-mode table td { border-color: #334155 !important; color: #e2e8f0 !important; }
        html.dark-mode table tr:hover td { background-color: rgba(51, 65, 85, 0.45) !important; }
        html.dark-mode input, html.dark-mode select, html.dark-mode textarea { background-color: #0f172a !important; border-color: #475569 !important; color: #f8fafc !important; }
        html.dark-mode input::placeholder, html.dark-mode textarea::placeholder { color: #64748b !important; }
        html.dark-mode .state-btn { background-color: #0f172a !important; border-color: #334155 !important; }
        html.dark-mode .state-btn span { color: #cbd5e1 !important; }
        html.dark-mode .state-btn.active-work { background-color: rgba(22, 163, 74, 0.18) !important; border-color: #22c55e !important; }
        html.dark-mode .state-btn.active-break { background-color: rgba(37, 99, 235, 0.18) !important; border-color: #3b82f6 !important; }
        html.dark-mode .state-btn.active-pause { background-color: rgba(217, 119, 6, 0.18) !important; border-color: #f59e0b !important; }
        html.dark-mode .state-btn.active-off { background-color: #1e293b !important; border-color: #64748b !important; }
        html.dark-mode .btn-secondary, html.dark-mode .btn-calc { background-color: #1e293b !important; border-color: #475569 !important; color: #e2e8f0 !important; }
        html.dark-mode .btn-secondary:hover, html.dark-mode .btn-calc:hover { background-color: #334155 !important; }
        html.dark-mode .border-slate-100, html.dark-mode .border-slate-200, html.dark-mode .border-slate-200\\/80 { border-color: #334155 !important; }
        html.dark-mode .progress-track { background-color: #334155 !important; }
        html.dark-mode #loading-overlay { background-color: rgba(15, 23, 42, 0.85) !important; }
        html.dark-mode .toast { background-color: #1e293b !important; color: #f8fafc !important; border: 1px solid #334155; }

        @keyframes pulseRedAlarmZ8 {
            0%, 100% { background-color: rgba(185, 28, 28, 0.94); box-shadow: inset 0 0 80px #000; }
            50% { background-color: rgba(239, 68, 68, 0.97); box-shadow: inset 0 0 120px #7f1d1d; }
        }
        .alarma-fullscreen-z8 {
            animation: pulseRedAlarmZ8 1s infinite ease-in-out;
        }

        /* Módulo de Chat de Dos Columnas (Estilo Mensajería Profesional) */
        .z8-chat-shell {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            overflow: hidden;
            display: flex;
            height: calc(100vh - 115px);
            min-height: 550px;
            max-height: 780px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
        }
        .z8-chat-sidebar {
            width: 215px;
            border-right: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            background-color: #f8fafc;
            flex-shrink: 0;
        }
        .z8-chat-item {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 10px 12px;
            margin: 2px 8px;
            border-radius: 10px;
            cursor: pointer;
            transition: background-color 0.15s;
            text-align: left;
            width: calc(100% - 16px);
        }
        .z8-chat-item:hover { background-color: #f1f5f9; }
        .z8-chat-item.active { background-color: #e2e8f0; }
        .z8-chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            background-color: #ffffff;
        }
        .z8-chat-canvas {
            flex: 1;
            margin: 0 14px;
            border-radius: 12px;
            background-color: #f8fafc;
            border: 1px solid #f1f5f9;
            padding: 16px;
            overflow-y: auto;
        }
        .z8-bubble-in {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            color: #1e293b;
            border-radius: 12px;
            padding: 10px 14px;
            max-width: 72%;
            box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .z8-bubble-out {
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1e3a8a;
            border-radius: 12px;
            padding: 10px 14px;
            max-width: 72%;
        }
        .z8-chat-input-box {
            margin: 12px 14px 14px 14px;
            border: 1px solid #e2e8f0;
            background-color: #f8fafc;
            border-radius: 12px;
            padding: 6px 8px 6px 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Modo Oscuro exacto al diseño de referencia */
        html.dark-mode .z8-chat-shell {
            background-color: #141416 !important;
            border-color: #27272a !important;
            box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.6) !important;
        }
        html.dark-mode .z8-chat-sidebar {
            background-color: #141416 !important;
            border-right-color: #262629 !important;
        }
        html.dark-mode .z8-chat-item:hover { background-color: #1f1f23 !important; }
        html.dark-mode .z8-chat-item.active { background-color: #27272c !important; }
        html.dark-mode .z8-chat-main { background-color: #141416 !important; }
        html.dark-mode .z8-chat-canvas {
            background-color: #0b0b0c !important;
            border-color: #1f1f23 !important;
        }
        html.dark-mode .z8-bubble-in {
            background-color: #1c1c20 !important;
            border-color: #27272c !important;
            color: #f4f4f5 !important;
        }
        html.dark-mode .z8-bubble-out {
            background-color: #222227 !important;
            border-color: #32323a !important;
            color: #f4f4f5 !important;
        }
        html.dark-mode .z8-chat-input-box {
            background-color: #18181b !important;
            border-color: #2e2e34 !important;
        }
        @media (max-width: 680px) {
            .z8-chat-shell { flex-direction: column; height: 640px; }
            .z8-chat-sidebar { width: 100%; height: 210px; border-right: none; border-bottom: 1px solid #27272a; }
        }
    `;
    document.head.appendChild(st);
}

function obtenerTemaPreferidoZ8() {
    return localStorage.getItem('tt_theme_pref') || 'auto';
}

function aplicarTemaZ8(pref) {
    inyectarEstilosGlobalesZ8();
    const modo = pref || obtenerTemaPreferidoZ8();
    localStorage.setItem('tt_theme_pref', modo);

    const mediaDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const usarOscuro = (modo === 'dark') || (modo === 'auto' && mediaDark);

    if (usarOscuro) {
        document.documentElement.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
    }

    const btn = document.getElementById('btn-tema-z8');
    if (btn) {
        if (modo === 'auto') {
            btn.innerHTML = usarOscuro ? '🌓 Auto (Oscuro)' : '🌓 Auto (Claro)';
            btn.title = 'Siguiendo el tema de tu navegador. Clic para cambiar.';
        } else if (modo === 'dark') {
            btn.innerHTML = '🌙 Oscuro';
            btn.title = 'Modo oscuro fijo. Clic para cambiar.';
        } else {
            btn.innerHTML = '☀️ Claro';
            btn.title = 'Modo claro fijo. Clic para cambiar.';
        }
    }
}

function ciclarTemaZ8() {
    const actual = obtenerTemaPreferidoZ8();
    const siguiente = actual === 'auto' ? 'dark' : (actual === 'dark' ? 'light' : 'auto');
    aplicarTemaZ8(siguiente);
}

// Inicializar el tema apenas carga api.js y escuchar cambios del navegador en tiempo real
(function initThemeListenerZ8() {
    inyectarEstilosGlobalesZ8();
    aplicarTemaZ8(obtenerTemaPreferidoZ8());
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) {
            mq.addEventListener('change', () => {
                if (obtenerTemaPreferidoZ8() === 'auto') aplicarTemaZ8('auto');
            });
        }
    }
    window.addEventListener('DOMContentLoaded', () => aplicarTemaZ8(obtenerTemaPreferidoZ8()));
})();

// ============================================================================
// 2. MOTOR DE SONIDO (WEB AUDIO API) Y NOTIFICACIONES DE ESCRITORIO WINDOWS
// ============================================================================
const SoundEngineZ8 = {
    ctx: null,
    alarmInterval: null,
    titleInterval: null,
    originalTitle: document.title,

    initContext() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!this.ctx && AudioCtx) this.ctx = new AudioCtx();
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        } catch (e) {}
    },

    playTone(freq, type, durationSec, startDelaySec = 0, gainVal = 0.25) {
        try {
            this.initContext();
            if (!this.ctx) return;
            const now = this.ctx.currentTime + startDelaySec;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + durationSec + 0.02);
        } catch (e) {}
    },

    playChatPing() {
        this.playTone(587.33, 'sine', 0.11, 0, 0.15);
        this.playTone(880, 'sine', 0.16, 0.09, 0.18);
    },

    playNotificationChime() {
        this.playTone(523.25, 'triangle', 0.18, 0, 0.28);
        this.playTone(659.25, 'triangle', 0.18, 0.14, 0.28);
        this.playTone(783.99, 'triangle', 0.30, 0.28, 0.32);
        this.playTone(1046.5, 'sine', 0.40, 0.44, 0.30);
    },

    playAlarmBurst() {
        this.playTone(880, 'sawtooth', 0.28, 0, 0.36);
        this.playTone(622.25, 'sawtooth', 0.28, 0.30, 0.36);
        this.playTone(880, 'sawtooth', 0.28, 0.60, 0.36);
        this.playTone(622.25, 'sawtooth', 0.35, 0.90, 0.36);
    },

    startAlarmLoop() {
        this.stopAlarmLoop();
        this.originalTitle = document.title;
        this.playAlarmBurst();
        this.alarmInterval = setInterval(() => this.playAlarmBurst(), 1600);
        let toggle = false;
        this.titleInterval = setInterval(() => {
            toggle = !toggle;
            document.title = toggle ? '🚨 ¡ALARMA SUPERVISIÓN! 🚨' : '⚠️ CONFIRMA TU ATENCIÓN ⚠️';
        }, 700);
    },

    stopAlarmLoop() {
        if (this.alarmInterval) { clearInterval(this.alarmInterval); this.alarmInterval = null; }
        if (this.titleInterval) { clearInterval(this.titleInterval); this.titleInterval = null; }
        if (this.originalTitle) document.title = this.originalTitle;
    },

    notifyDesktop(titulo, cuerpo, urgente = false) {
        try {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'granted') {
                const n = new Notification(titulo, {
                    body: cuerpo,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2088/2088617.png',
                    requireInteraction: urgente
                });
                n.onclick = () => { window.focus(); n.close(); };
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        } catch (e) {}
    }
};

// Desbloquear AudioContext y permisos de notificación en el primer clic del usuario
window.addEventListener('click', function _unlockAudioZ8() {
    SoundEngineZ8.initContext();
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}, { once: true });

// ============================================================================
// 3. CANAL EN TIEMPO REAL Y SUITE INTERACTIVA (CHAT + ALARMAS + PERFIL)
// ============================================================================
let _canalOperativoZ8 = null;
let _contextoUsuarioZ8 = { usuario: null, rol: null };
let _mensajesChatZ8 = [];
let _conversacionActivaZ8 = 'GENERAL'; // 'GENERAL' o nombre de usuario
let _noLeidosChatZ8 = {};
let _chatAbiertoZ8 = false;
let _alertaActivaModalZ8 = null;
let _alertaInicioMsZ8 = null;
let _alertaRelojIntervalZ8 = null;
let _idsAlertasConfirmadasLocalZ8 = new Set();

async function emitirEventoOperativoZ8(evento, payload) {
    try {
        if (!_canalOperativoZ8 && typeof supabaseClient !== 'undefined') {
            _canalOperativoZ8 = supabaseClient.channel('canal_operativo_z8');
            await _canalOperativoZ8.subscribe();
        }
        if (_canalOperativoZ8) {
            await _canalOperativoZ8.send({
                type: 'broadcast',
                event: evento,
                payload: payload
            });
        }
    } catch (e) {}
}

function renderAvatarHTMLZ8(usuario, sizePx = 32) {
    const usr = (usuario || "?").trim().toUpperCase();
    const p = (window._cachePerfilesZ8 && window._cachePerfilesZ8[usr]) || {};
    const iniciales = usr.substring(0, 2);
    const bg = p.colorAvatar || '#2563eb';
    if (p.fotoDataUrl && p.fotoDataUrl.startsWith('data:image')) {
        return `<img src="${p.fotoDataUrl}" alt="${usr}" style="width:${sizePx}px;height:${sizePx}px;border-radius:9999px;object-fit:cover;border:2px solid ${bg};flex-shrink:0;">`;
    }
    const fontSize = Math.max(10, Math.floor(sizePx * 0.4));
    return `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:9999px;background:${bg};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:${fontSize}px;flex-shrink:0;letter-spacing:0.02em;">${iniciales}</div>`;
}

// Catálogo curado de GIFs animados rápidos (Giphy + Google Noto Animated) con buscador por etiquetas
const CATALOGO_GIFS_Z8 = [
    { title: "Aplausos / Bravo", tags: "aplausos bravo bien genial clap", cat: "reacciones", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44f/512.gif" },
    { title: "Pulgar Arriba OK", tags: "ok bien vale perfecto si like", cat: "reacciones", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif" },
    { title: "Fuego / A tope", tags: "fuego tope crack excelente fire", cat: "populares", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif" },
    { title: "Fiesta / Celebración", tags: "fiesta celebracion exito objetivo ganado party", cat: "celebracion", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.gif" },
    { title: "Confeti / Victoria", tags: "confeti victoria meta cumplida felicidades", cat: "celebracion", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif" },
    { title: "Cohete / Vamos", tags: "cohete vamos rapido arriba equipo", cat: "populares", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif" },
    { title: "Risa / Jajaja", tags: "risa jajaja lol gracioso humor", cat: "humor", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif" },
    { title: "Muerto de risa", tags: "risa carcajada jajaja humor", cat: "humor", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f923/512.gif" },
    { title: "Gracias / Por favor", tags: "gracias porfavor manos agradecimiento", cat: "reacciones", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f64f/512.gif" },
    { title: "Fuerza / Ánimo", tags: "fuerza animo vamos equipo musculo", cat: "trabajo", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f4aa/512.gif" },
    { title: "Saludando / Hola", tags: "hola buenos dias buenas tardes adios saludo", cat: "populares", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44b/512.gif" },
    { title: "Pensando / Duda", tags: "pensando duda mmm pregunta", cat: "trabajo", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f914/512.gif" },
    { title: "Ojos / Atento", tags: "ojos atento mirando revisando", cat: "trabajo", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f440/512.gif" },
    { title: "Café / Descanso", tags: "cafe descanso break desayuno", cat: "trabajo", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.gif" },
    { title: "Reloj / Tiempo", tags: "reloj tiempo hora turno", cat: "trabajo", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/23f0/512.gif" },
    { title: "Sirena / Urgente", tags: "sirena urgente alerta atencion", cat: "trabajo", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f6a8/512.gif" },
    { title: "Corazón / Equipo", tags: "corazon amor gracias genial", cat: "reacciones", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif" },
    { title: "Estrellas / Increíble", tags: "estrellas increible genial top", cat: "celebracion", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f929/512.gif" },
    { title: "Gafas de sol / Pro", tags: "gafas pro crack listo", cat: "populares", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif" },
    { title: "Sudando / Uff", tags: "sudando uff llamada dificil", cat: "humor", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f605/512.gif" },
    { title: "Mente explotando", tags: "mente boom increible sorpresa", cat: "humor", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.gif" },
    { title: "Trofeo / Campeón", tags: "trofeo campeon primero ganador", cat: "celebracion", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f3c6/512.gif" },
    { title: "100 Puntos", tags: "100 perfecto excelente", cat: "populares", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f4af/512.gif" },
    { title: "Manos Arriba", tags: "manos arriba bien si", cat: "celebracion", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f64c/512.gif" }
];

const LISTA_EMOJIS_Z8 = [
    "👍","👏","🔥","✅","❤️","🙌","🎉","🚀","💪","😊",
    "😀","😂","🤣","😉","😎","🥳","🤩","🤔","😅","🙏",
    "👋","👀","📞","🎧","💻","📋","⏰","☕","⚡","🚨",
    "📌","💬","💯","🏆","✨","🤝","🫡","🆗","➕","➖"
];

async function iniciarSuiteInteractivaZ8(opciones = {}) {
    const usr = (opciones.usuario || localStorage.getItem('tt_usuario') || '').trim().toUpperCase();
    const rol = opciones.rol || localStorage.getItem('tt_rol') || 'agente';
    if (!usr) return;

    _contextoUsuarioZ8 = { usuario: usr, rol: rol };

    // 1. Cargar perfiles de todos los usuarios
    await fetchGoogleAPI("getPerfilesUsuarios", {});
    const miPerfil = window._cachePerfilesZ8[usr];
    if (miPerfil && miPerfil.temaPreferido && !localStorage.getItem('tt_theme_manual_override')) {
        aplicarTemaZ8(miPerfil.temaPreferido);
    }

    // 2. Construir Modales de Alarma/Notificación, Perfil y Burbuja de Chat
    inyectarComponentesInteractivosDOMZ8();
    actualizarCabeceraPerfilAgenteUI();

    // 3. Suscribirse al canal en tiempo real de Supabase
    if (typeof supabaseClient !== 'undefined') {
        _canalOperativoZ8 = supabaseClient
            .channel('canal_operativo_z8')
            .on('broadcast', { event: 'nueva_alerta_supervision' }, payload => {
                const alerta = payload ? payload.payload : null;
                if (alerta) procesarAlertaEntranteZ8(alerta);
            })
            .on('broadcast', { event: 'acuse_alerta_supervision' }, payload => {
                if (typeof window.onAcuseAlertaSupervisionZ8 === 'function') {
                    window.onAcuseAlertaSupervisionZ8(payload.payload);
                }
            })
            .on('broadcast', { event: 'nuevo_mensaje_chat' }, payload => {
                const msg = payload ? payload.payload : null;
                if (msg) recibirMensajeChatRealtimeZ8(msg);
            })
            .on('broadcast', { event: 'cambio_notas_reunion' }, () => {
                if (typeof window.recargarNotasReunionUI === 'function') {
                    window.recargarNotasReunionUI();
                }
            })
            .on('broadcast', { event: 'perfil_actualizado' }, async () => {
                await fetchGoogleAPI("getPerfilesUsuarios", {});
                actualizarCabeceraPerfilAgenteUI();
                renderContactosChatZ8();
                renderMensajesChatZ8();
                if (typeof window.onPerfilesActualizadosZ8 === 'function') {
                    window.onPerfilesActualizadosZ8();
                }
            })
            .subscribe();
    }

    // 4. Cargar historial de chat y comprobar alertas pendientes para agentes
    await cargarHistorialChatInicialZ8();
    if (rol !== 'admin') {
        await verificarAlertasPendientesAgenteZ8();
    }
}

function inyectarComponentesInteractivosDOMZ8() {
    if (document.getElementById('suite-interactiva-z8-root')) return;
    const root = document.createElement('div');
    root.id = 'suite-interactiva-z8-root';
    root.innerHTML = `
        <!-- MODAL DE ALARMA DE ATENCIÓN / NOTIFICACIÓN DE SUPERVISIÓN -->
        <div id="modal-alerta-supervision-z8" class="hidden fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div id="caja-alerta-supervision-z8" class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-4 border-red-600 text-center relative">
                <div id="icono-alerta-supervision-z8" class="text-5xl mb-3">🚨</div>
                <div id="badge-tipo-alerta-z8" class="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-red-100 text-red-700 mb-2">Alarma de Atención</div>
                <h2 id="titulo-alerta-supervision-z8" class="text-xl font-black text-slate-900 mb-2">¡Atención Requerida!</h2>
                <p id="mensaje-alerta-supervision-z8" class="text-sm text-slate-600 mb-4 whitespace-pre-line"></p>
                <div class="text-xs font-mono font-bold text-red-600 mb-5" id="cronometro-alerta-supervision-z8">Tiempo transcurrido: 0s</div>
                <button onclick="confirmarRecepcionAlertaActivaZ8()" id="btn-confirmar-alerta-z8" class="w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white shadow-lg transition transform active:scale-95">
                    ✋ Estoy aquí / Enterado
                </button>
            </div>
        </div>

        <!-- MODAL DE PERFIL Y SETUP DEL AGENTE -->
        <div id="modal-perfil-usuario-z8" class="hidden fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div class="bento-panel max-w-lg w-full max-h-[90vh] overflow-y-auto !p-6 relative shadow-2xl">
                <div class="flex justify-between items-center pb-3 mb-4 border-b border-slate-200">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xl">👤</span>
                        <div>
                            <h3 class="text-base font-bold text-slate-800" id="titulo-modal-perfil-z8">Mi Perfil Operativo</h3>
                            <p class="text-[11px] text-slate-400">Datos de contacto, foto, preferencias y resumen</p>
                        </div>
                    </div>
                    <button onclick="cerrarModalPerfilZ8()" class="text-slate-400 hover:text-slate-700 text-lg font-bold px-2">✕</button>
                </div>

                <!-- Tarjeta rápida de métricas personales en el perfil -->
                <div id="perfil-metricas-box-z8" class="grid grid-cols-3 gap-2 mb-4 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-center">
                    <div>
                        <div class="text-[10px] font-bold text-slate-400 uppercase">Horas Mes</div>
                        <div id="perfil-kpi-horas" class="text-sm font-black font-mono text-blue-700">00:00:00</div>
                    </div>
                    <div>
                        <div class="text-[10px] font-bold text-slate-400 uppercase">% Cumplimiento</div>
                        <div id="perfil-kpi-pct" class="text-sm font-black text-emerald-600">0%</div>
                    </div>
                    <div>
                        <div class="text-[10px] font-bold text-slate-400 uppercase">Días Activos</div>
                        <div id="perfil-kpi-dias" class="text-sm font-black text-slate-700">0 días</div>
                    </div>
                </div>

                <!-- Foto y color de avatar -->
                <div class="flex flex-col sm:flex-row items-center gap-4 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div id="preview-avatar-perfil-z8" class="shrink-0"></div>
                    <div class="flex-1 text-center sm:text-left">
                        <div class="text-xs font-bold text-slate-700 mb-1">Foto de Perfil / Avatar</div>
                        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <label class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition">
                                📷 Subir Foto
                                <input type="file" id="input-foto-perfil-z8" accept="image/*" class="hidden" onchange="procesarSubidaFotoPerfilZ8(event)">
                            </label>
                            <button type="button" onclick="quitarFotoPerfilZ8()" class="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100">Quitar foto</button>
                            <input type="color" id="input-color-avatar-z8" value="#2563eb" onchange="actualizarPreviewAvatarModalZ8()" class="w-8 h-8 rounded cursor-pointer border-0" title="Color de avatar">
                        </div>
                        <p class="text-[10px] text-slate-400 mt-1">Se ajusta y optimiza automáticamente.</p>
                    </div>
                </div>

                <!-- Formulario de datos -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre / Alias visible</label>
                        <input type="text" id="perf-nombre" class="w-full px-3 py-2 rounded-lg border border-slate-200">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Servicio / Departamento</label>
                        <select id="perf-servicio" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold">
                            <option value="Transfer">Transfer</option>
                            <option value="Asistencia">Asistencia</option>
                            <option value="Coordinación">Coordinación</option>
                            <option value="Supervisión">Supervisión</option>
                            <option value="General">General</option>
                        </select>
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                        <input type="email" id="perf-correo" placeholder="ejemplo@correo.com" class="w-full px-3 py-2 rounded-lg border border-slate-200">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teléfono Móvil</label>
                        <input type="tel" id="perf-movil" placeholder="+34 600 000 000" class="w-full px-3 py-2 rounded-lg border border-slate-200">
                    </div>
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase">WhatsApp</label>
                            <button type="button" onclick="copiarMovilAWhatsappZ8()" class="text-[10px] text-blue-600 font-bold hover:underline">Igual al móvil</button>
                        </div>
                        <input type="tel" id="perf-whatsapp" placeholder="+34 600 000 000" class="w-full px-3 py-2 rounded-lg border border-slate-200">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Usuario Mattermost</label>
                        <input type="text" id="perf-mattermost" placeholder="@usuario" class="w-full px-3 py-2 rounded-lg border border-slate-200">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tema Visual</label>
                        <select id="perf-tema" onchange="aplicarTemaZ8(this.value)" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold">
                            <option value="auto">🌓 Automático (según navegador)</option>
                            <option value="light">☀️ Modo Claro</option>
                            <option value="dark">🌙 Modo Oscuro</option>
                        </select>
                    </div>
                    <div class="sm:col-span-2 pt-2 border-t border-slate-200 mt-1">
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cambiar Contraseña (dejar en blanco para mantener la actual)</label>
                        <input type="password" id="perf-nueva-clave" placeholder="Nueva contraseña..." class="w-full px-3 py-2 rounded-lg border border-slate-200">
                    </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-200">
                    <button type="button" onclick="probarSonidoYNotificacionZ8()" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5">
                        🔊 Probar Sonido y Alerta
                    </button>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="cerrarModalPerfilZ8()" class="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-500">Cancelar</button>
                        <button type="button" id="btn-guardar-perfil-z8" onclick="guardarMiPerfilZ8()" class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">Guardar Perfil</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MÓDULO DE CHAT CON BARRA LATERAL DE CANALES Y MENSAJES DIRECTOS -->
        <div id="chat-module-wrapper-z8">
            <div id="chat-window-z8" class="z8-chat-shell">
                <!-- COLUMNA IZQUIERDA: BARRA LATERAL DE NAVEGACIÓN DE CANALES Y AGENTES -->
                <div class="z8-chat-sidebar">
                    <div class="p-3.5 pb-2">
                        <div class="flex items-center justify-between mb-2.5 px-1">
                            <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Canales y Mensajes</span>
                            <span id="badge-sidebar-total-z8" class="hidden px-2 py-0.5 text-[10px] font-black bg-blue-600 text-white rounded-full">0</span>
                        </div>
                        <div class="z8-chat-search flex items-center gap-2 px-3 py-2">
                            <span class="text-slate-400 text-xs">🔍</span>
                            <input type="text" id="chat-sidebar-search-z8" oninput="renderContactosChatZ8()" placeholder="Buscar mensajes o canales..." class="bg-transparent border-none outline-none text-xs w-full">
                        </div>
                    </div>
                    <div id="chat-contactos-bar-z8" class="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5"></div>
                </div>

                <!-- COLUMNA DERECHA: CONVERSACIÓN ACTIVA -->
                <div class="z8-chat-main">
                    <!-- Cabecera de la conversación -->
                    <div class="px-5 py-3.5 flex items-center justify-between shrink-0">
                        <div class="flex items-center gap-3 min-w-0">
                            <div id="chat-header-avatar-z8" class="shrink-0"></div>
                            <div class="min-w-0">
                                <div class="text-sm font-extrabold truncate" id="chat-header-title-z8">Sala General</div>
                                <div class="text-[11px] text-emerald-500 font-semibold flex items-center gap-1.5" id="chat-header-sub-z8">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                    <span>Activo ahora · Canal general de equipo</span>
                                </div>
                            </div>
                        </div>
                        <div id="chat-header-actions-z8" class="flex items-center gap-1.5"></div>
                    </div>

                    <!-- Lienzo interior de mensajes -->
                    <div id="chat-mensajes-feed-z8" class="z8-chat-canvas flex-1 overflow-y-auto space-y-3 text-xs"></div>

                    <!-- Panel Selector de Emojis (Oculto por defecto) -->
                    <div id="chat-emoji-picker-z8" class="hidden mx-3.5 mb-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 max-h-36 overflow-y-auto grid grid-cols-10 gap-1 text-center shrink-0"></div>

                    <!-- Panel Buscador de GIFs (Oculto por defecto) -->
                    <div id="chat-gif-picker-z8" class="hidden mx-3.5 mb-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 shrink-0">
                        <div class="flex items-center gap-1.5 mb-2">
                            <input type="text" id="chat-gif-search-z8" oninput="filtrarCatalogoGifsZ8()" placeholder="Buscar GIF (ej. aplausos, ok, risa, fiesta, café...)" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white outline-none">
                            <button type="button" onclick="enviarGifPorUrlManualZ8()" class="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-[10px] font-bold text-slate-200" title="Pegar enlace directo de un GIF">+ URL</button>
                        </div>
                        <div id="chat-gif-grid-z8" class="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto"></div>
                    </div>

                    <!-- Barra inferior redondeada de escritura -->
                    <form onsubmit="enviarMensajeChatDesdeUIZ8(event)" class="px-3.5 pb-3.5 shrink-0">
                        <div class="z8-chat-input-box flex items-center gap-2 px-3.5 py-2">
                            <input type="text" id="chat-input-txt-z8" placeholder="Escribe un mensaje..." class="flex-1 bg-transparent border-none text-xs outline-none">
                            <button type="button" onclick="toggleEmojiPickerZ8()" class="p-1.5 rounded-lg hover:bg-slate-500/20 text-base transition" title="Insertar Emoji">😊</button>
                            <button type="button" onclick="toggleGifPickerZ8()" class="px-2 py-1 rounded-lg hover:bg-slate-500/20 text-[10px] font-black text-blue-400 border border-blue-500/30 transition" title="Enviar GIF animado">GIF</button>
                            <button type="submit" class="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-sm transition" title="Enviar mensaje">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Botón Flotante de Acceso Rápido / Contador de No Leídos (solo pantallas pequeñas) -->
        <div id="chat-widget-container-z8" class="xl:hidden fixed bottom-4 right-4 z-[9900] font-sans">
            <button onclick="irAlModuloChatZ8()" id="btn-burbuja-chat-z8" class="relative flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xl border border-slate-700 transition transform hover:scale-105">
                <span class="text-sm">💬</span>
                <span>Canales y Chat</span>
                <span id="badge-chat-noleidos-z8" class="hidden px-1.5 py-0.5 text-[10px] font-black bg-red-500 text-white rounded-full min-w-[18px] text-center">0</span>
            </button>
        </div>
    `;
    document.body.appendChild(root);

    // Si la página tiene un contenedor embebido (#chat-embedded-mount-z8), montamos ahí el módulo de chat de 2 columnas
    montarChatEnContenedorPaginaZ8();

    // Poblar selector de Emojis y GIFs
    const emojiCont = document.getElementById('chat-emoji-picker-z8');
    if (emojiCont) {
        emojiCont.innerHTML = LISTA_EMOJIS_Z8.map(em =>
            `<button type="button" onclick="insertarEmojiChatZ8('${em}')" class="hover:bg-slate-700 rounded p-1 text-base transition">${em}</button>`
        ).join('');
    }
    filtrarCatalogoGifsZ8();
    seleccionarConversacionChatZ8(_conversacionActivaZ8 || 'GENERAL');
}

function montarChatEnContenedorPaginaZ8() {
    const mount = document.getElementById('chat-embedded-mount-z8');
    const wrapper = document.getElementById('chat-module-wrapper-z8');
    if (mount && wrapper && wrapper.parentElement !== mount) {
        mount.appendChild(wrapper);
        _chatAbiertoZ8 = true;
    }
}

function irAlModuloChatZ8() {
    montarChatEnContenedorPaginaZ8();
    if (typeof window.cambiarTab === 'function' && document.getElementById('vista-chat')) {
        window.cambiarTab('chat');
    }
    const win = document.getElementById('chat-window-z8');
    if (win) {
        win.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            const inp = document.getElementById('chat-input-txt-z8');
            if (inp) inp.focus();
        }, 250);
    }
}

// ============================================================================
// FUNCIONES DE ALARMAS Y NOTIFICACIONES EN TIEMPO REAL
// ============================================================================
async function verificarAlertasPendientesAgenteZ8() {
    try {
        const usr = _contextoUsuarioZ8.usuario;
        if (!usr || _contextoUsuarioZ8.rol === 'admin') return;
        const alertas = await fetchGoogleAPI("getAlertasSupervision", {});
        const hace12h = Date.now() - (12 * 3600 * 1000);
        for (const a of alertas) {
            const creadoMs = new Date(a.creadoEn).getTime();
            if (isNaN(creadoMs) || creadoMs < hace12h) continue;
            if (a.destino === 'TODOS' || a.destino === usr) {
                if (!a.acuses || !a.acuses[usr]) {
                    procesarAlertaEntranteZ8(a);
                    break;
                }
            }
        }
    } catch (e) {}
}

function procesarAlertaEntranteZ8(alerta) {
    const usr = _contextoUsuarioZ8.usuario;
    if (!usr || _contextoUsuarioZ8.rol === 'admin') return;
    if (alerta.destino !== 'TODOS' && alerta.destino !== usr) return;
    if (_idsAlertasConfirmadasLocalZ8.has(alerta.id)) return;
    if (alerta.acuses && alerta.acuses[usr]) return;

    _alertaActivaModalZ8 = alerta;
    _alertaInicioMsZ8 = Date.now();

    const modal = document.getElementById('modal-alerta-supervision-z8');
    const caja = document.getElementById('caja-alerta-supervision-z8');
    const icono = document.getElementById('icono-alerta-supervision-z8');
    const badge = document.getElementById('badge-tipo-alerta-z8');
    const titulo = document.getElementById('titulo-alerta-supervision-z8');
    const mensaje = document.getElementById('mensaje-alerta-supervision-z8');
    const crono = document.getElementById('cronometro-alerta-supervision-z8');
    const btn = document.getElementById('btn-confirmar-alerta-z8');

    if (!modal) return;
    modal.classList.remove('hidden');

    const esAlarma = alerta.tipoAlerta === 'ALARMA_ATENCION';
    if (esAlarma) {
        modal.classList.add('alarma-fullscreen-z8');
        caja.className = "bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-4 border-red-600 text-center relative";
        icono.textContent = "🚨";
        badge.className = "inline-block px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-red-100 text-red-700 mb-2";
        badge.textContent = "Alarma de Atención en Bucle";
        btn.className = "w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white shadow-lg transition transform active:scale-95";
        btn.textContent = "✋ Estoy aquí / Apagar Alarma";
        SoundEngineZ8.startAlarmLoop();
        SoundEngineZ8.notifyDesktop(alerta.titulo || "🚨 ¡ALARMA DE SUPERVISIÓN!", alerta.mensaje || "Confirma inmediatamente tu presencia en el panel.", true);
    } else {
        modal.classList.remove('alarma-fullscreen-z8');
        caja.className = "bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-4 border-blue-600 text-center relative";
        icono.textContent = "📢";
        badge.className = "inline-block px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700 mb-2";
        badge.textContent = alerta.destino === 'TODOS' ? "Comunicado General (Broadcast)" : "Mensaje Directo de Supervisión";
        btn.className = "w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition transform active:scale-95";
        btn.textContent = "✅ Enterado / Recibido";
        SoundEngineZ8.playNotificationChime();
        SoundEngineZ8.notifyDesktop(alerta.titulo || "📢 Aviso de Supervisión", alerta.mensaje || "", true);
    }

    titulo.textContent = alerta.titulo || "Aviso de Supervisión";
    mensaje.textContent = alerta.mensaje || "";
    crono.textContent = "Tiempo de respuesta: 0s";

    if (_alertaRelojIntervalZ8) clearInterval(_alertaRelojIntervalZ8);
    _alertaRelojIntervalZ8 = setInterval(() => {
        const s = Math.max(0, Math.floor((Date.now() - _alertaInicioMsZ8) / 1000));
        crono.textContent = `Tiempo de respuesta: ${s}s`;
    }, 1000);
}

async function confirmarRecepcionAlertaActivaZ8() {
    SoundEngineZ8.stopAlarmLoop();
    if (_alertaRelojIntervalZ8) { clearInterval(_alertaRelojIntervalZ8); _alertaRelojIntervalZ8 = null; }

    const modal = document.getElementById('modal-alerta-supervision-z8');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('alarma-fullscreen-z8');
    }

    if (!_alertaActivaModalZ8) return;
    const alerta = _alertaActivaModalZ8;
    _alertaActivaModalZ8 = null;
    _idsAlertasConfirmadasLocalZ8.add(alerta.id);

    const segs = Math.max(1, Math.floor((Date.now() - (_alertaInicioMsZ8 || Date.now())) / 1000));
    try {
        await fetchGoogleAPI("confirmarAlertaSupervision", {
            alertaId: alerta.id,
            usuario: _contextoUsuarioZ8.usuario,
            segundosRespuesta: segs
        });
    } catch (e) {}
}

function probarSonidoYNotificacionZ8() {
    SoundEngineZ8.playNotificationChime();
    SoundEngineZ8.notifyDesktop("🔔 Prueba de Audio y Notificación", "El sonido y los avisos de escritorio de TimeTrack están funcionando correctamente.", false);
}

// ============================================================================
// FUNCIONES DE PERFIL Y SETUP DEL AGENTE
// ============================================================================
let _fotoTemporalPerfilZ8 = null;

function actualizarCabeceraPerfilAgenteUI() {
    const usr = _contextoUsuarioZ8.usuario;
    if (!usr) return;
    const p = (window._cachePerfilesZ8 && window._cachePerfilesZ8[usr]) || {};

    const contAvatar = document.getElementById('header-avatar-agente-z8');
    if (contAvatar) contAvatar.innerHTML = renderAvatarHTMLZ8(usr, 34);

    const lblServicio = document.getElementById('header-servicio-agente-z8');
    if (lblServicio) lblServicio.textContent = p.servicio || 'Agente';

    const bannerSetup = document.getElementById('banner-setup-perfil-z8');
    if (bannerSetup && _contextoUsuarioZ8.rol !== 'admin') {
        const incompleto = !p.setupCompletado || (!p.correo && !p.movil && !p.whatsapp);
        bannerSetup.classList.toggle('hidden', !incompleto);
    }
}

function abrirModalPerfilZ8(usuarioObjetivo) {
    const usr = (usuarioObjetivo || _contextoUsuarioZ8.usuario || '').trim().toUpperCase();
    if (!usr) return;
    const esPropio = (usr === _contextoUsuarioZ8.usuario) || (_contextoUsuarioZ8.rol === 'admin');
    const p = (window._cachePerfilesZ8 && window._cachePerfilesZ8[usr]) || { usuario: usr };

    _fotoTemporalPerfilZ8 = p.fotoDataUrl || '';

    document.getElementById('titulo-modal-perfil-z8').textContent = (usr === _contextoUsuarioZ8.usuario)
        ? `Mi Perfil (${usr})`
        : `Ficha del Agente: ${usr}`;

    document.getElementById('perf-nombre').value = p.nombreMostrar || usr;
    document.getElementById('perf-servicio').value = p.servicio || 'General';
    document.getElementById('perf-correo').value = p.correo || '';
    document.getElementById('perf-movil').value = p.movil || '';
    document.getElementById('perf-whatsapp').value = p.whatsapp || '';
    document.getElementById('perf-mattermost').value = p.mattermost || '';
    document.getElementById('input-color-avatar-z8').value = p.colorAvatar || '#2563eb';
    document.getElementById('perf-tema').value = obtenerTemaPreferidoZ8();
    document.getElementById('perf-nueva-clave').value = '';

    const boxKpi = document.getElementById('perfil-metricas-box-z8');
    if (typeof datosMensualesAgente !== 'undefined' && datosMensualesAgente && usr === _contextoUsuarioZ8.usuario) {
        boxKpi.classList.remove('hidden');
        const tot = datosMensualesAgente.totalMes || 0;
        const prev = datosMensualesAgente.previstas || (8 * 22 * 3600);
        const pct = prev > 0 ? Math.min(999, Math.round((tot / prev) * 100)) : 0;
        const diasActivos = Object.keys(datosMensualesAgente.dias || {}).length;
        const h = Math.floor(tot / 3600);
        const m = Math.floor((tot % 3600) / 60);
        document.getElementById('perfil-kpi-horas').textContent = `${h}h ${m}m`;
        document.getElementById('perfil-kpi-pct').textContent = `${pct}%`;
        document.getElementById('perfil-kpi-dias').textContent = `${diasActivos} días`;
    } else {
        boxKpi.classList.add('hidden');
    }

    document.getElementById('modal-perfil-usuario-z8').dataset.usuarioTarget = usr;
    actualizarPreviewAvatarModalZ8();

    const btnGuardar = document.getElementById('btn-guardar-perfil-z8');
    if (btnGuardar) btnGuardar.style.display = esPropio ? 'inline-block' : 'none';

    document.getElementById('modal-perfil-usuario-z8').classList.remove('hidden');
}

function cerrarModalPerfilZ8() {
    const m = document.getElementById('modal-perfil-usuario-z8');
    if (m) m.classList.add('hidden');
}

function actualizarPreviewAvatarModalZ8() {
    const modal = document.getElementById('modal-perfil-usuario-z8');
    const usr = (modal && modal.dataset.usuarioTarget) || _contextoUsuarioZ8.usuario || '?';
    const color = document.getElementById('input-color-avatar-z8').value || '#2563eb';
    const cont = document.getElementById('preview-avatar-perfil-z8');
    if (!cont) return;
    if (_fotoTemporalPerfilZ8 && _fotoTemporalPerfilZ8.startsWith('data:image')) {
        cont.innerHTML = `<img src="${_fotoTemporalPerfilZ8}" style="width:68px;height:68px;border-radius:9999px;object-fit:cover;border:3px solid ${color};">`;
    } else {
        cont.innerHTML = `<div style="width:68px;height:68px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;">${usr.substring(0, 2)}</div>`;
    }
}

function quitarFotoPerfilZ8() {
    _fotoTemporalPerfilZ8 = '';
    actualizarPreviewAvatarModalZ8();
}

function copiarMovilAWhatsappZ8() {
    const mov = document.getElementById('perf-movil').value.trim();
    if (mov) document.getElementById('perf-whatsapp').value = mov;
}

function procesarSubidaFotoPerfilZ8(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const size = 140;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            _fotoTemporalPerfilZ8 = canvas.toDataURL('image/jpeg', 0.78);
            actualizarPreviewAvatarModalZ8();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function guardarMiPerfilZ8() {
    const modal = document.getElementById('modal-perfil-usuario-z8');
    const usr = (modal && modal.dataset.usuarioTarget) || _contextoUsuarioZ8.usuario;
    const btn = document.getElementById('btn-guardar-perfil-z8');
    const txtOrig = btn.textContent;
    btn.textContent = "Guardando...";
    btn.disabled = true;

    try {
        const temaElegido = document.getElementById('perf-tema').value;
        aplicarTemaZ8(temaElegido);

        const perfilPayload = {
            nombreMostrar: document.getElementById('perf-nombre').value.trim() || usr,
            servicio: document.getElementById('perf-servicio').value,
            correo: document.getElementById('perf-correo').value.trim(),
            movil: document.getElementById('perf-movil').value.trim(),
            whatsapp: document.getElementById('perf-whatsapp').value.trim(),
            mattermost: document.getElementById('perf-mattermost').value.trim(),
            colorAvatar: document.getElementById('input-color-avatar-z8').value,
            fotoDataUrl: _fotoTemporalPerfilZ8 || '',
            temaPreferido: temaElegido
        };

        const nuevaClave = document.getElementById('perf-nueva-clave').value.trim();
        await fetchGoogleAPI("guardarPerfilUsuario", {
            usuario: usr,
            perfil: perfilPayload,
            nuevaClave: nuevaClave || null
        });

        await fetchGoogleAPI("getPerfilesUsuarios", {});
        actualizarCabeceraPerfilAgenteUI();
        renderContactosChatZ8();
        if (typeof window.onPerfilesActualizadosZ8 === 'function') window.onPerfilesActualizadosZ8();
        cerrarModalPerfilZ8();
        if (typeof showToast === 'function') showToast("✅ Perfil actualizado correctamente.");
    } catch (e) {
        alert("No se pudo guardar el perfil: " + (e.message || "Error"));
    } finally {
        btn.textContent = txtOrig;
        btn.disabled = false;
    }
}

// ============================================================================
// FUNCIONES DEL CHAT DE DOS COLUMNAS (CANALES + MENSAJES DIRECTOS 1 A 1)
// ============================================================================
const CANALES_EQUIPO_Z8 = [
    { id: 'GENERAL', nombre: 'Sala General', iniciales: 'SG', color: '#6366f1', desc: 'Canal general · Todos los agentes y supervisión' },
    { id: 'CANAL_TRANSFER', nombre: 'Canal Transfer', iniciales: 'TR', color: '#0ea5e9', desc: 'Canal operativo · Servicio Transfer' },
    { id: 'CANAL_ASISTENCIA', nombre: 'Canal Asistencia', iniciales: 'AS', color: '#10b981', desc: 'Canal operativo · Servicio Asistencia' },
    { id: 'CANAL_COORDINACION', nombre: 'Coordinación', iniciales: 'CO', color: '#f59e0b', desc: 'Avisos rápidos y coordinación de turno' }
];

function esCanalGrupalZ8(idDestino) {
    return idDestino === 'GENERAL' || String(idDestino || '').startsWith('CANAL_');
}

async function cargarHistorialChatInicialZ8() {
    try {
        const msgs = await fetchGoogleAPI("getMensajesChat", {});
        _mensajesChatZ8 = msgs || [];
        renderContactosChatZ8();
        renderMensajesChatZ8();
    } catch (e) {}
}

function esMensajeVisibleEnConversacionZ8(m, conversacion, miUsuario) {
    if (!m) return false;
    if (esCanalGrupalZ8(conversacion)) {
        return m.destino === conversacion;
    }
    return (
        (m.emisor === miUsuario && m.destino === conversacion) ||
        (m.emisor === conversacion && m.destino === miUsuario)
    );
}

function recibirMensajeChatRealtimeZ8(msg) {
    if (!msg || !msg.id) return;
    if (_mensajesChatZ8.some(x => x.id === msg.id)) return;

    const miUsuario = _contextoUsuarioZ8.usuario;
    const esGrupal = esCanalGrupalZ8(msg.destino);
    const esParaMiOGeneral = (esGrupal || msg.destino === miUsuario || msg.emisor === miUsuario);
    if (!esParaMiOGeneral) return;

    _mensajesChatZ8.push(msg);

    if (msg.emisor !== miUsuario) {
        SoundEngineZ8.playChatPing();
        const canalOrigen = esGrupal ? msg.destino : msg.emisor;
        if (_conversacionActivaZ8 !== canalOrigen) {
            _noLeidosChatZ8[canalOrigen] = (_noLeidosChatZ8[canalOrigen] || 0) + 1;
            actualizarBadgesNoLeidosChatZ8();
        }
    }

    renderContactosChatZ8();
    renderMensajesChatZ8();
}

function actualizarBadgesNoLeidosChatZ8() {
    const total = Object.values(_noLeidosChatZ8).reduce((acc, n) => acc + (n || 0), 0);
    const badge = document.getElementById('badge-chat-noleidos-z8');
    const badgeSide = document.getElementById('badge-sidebar-total-z8');
    const txt = total > 99 ? '99+' : String(total);
    if (badge) {
        badge.textContent = txt;
        badge.classList.toggle('hidden', total <= 0);
    }
    if (badgeSide) {
        badgeSide.textContent = txt;
        badgeSide.classList.toggle('hidden', total <= 0);
    }
}

function toggleChatWindowZ8(forzar) {
    irAlModuloChatZ8();
}

function renderAvatarCanalOAgenteZ8(idDestino, sizePx = 38) {
    const canal = CANALES_EQUIPO_Z8.find(c => c.id === idDestino);
    if (canal) {
        return `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:9999px;background:${canal.color};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:${Math.round(sizePx * 0.36)}px;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.2);">${canal.iniciales}</div>`;
    }
    const p = (window._cachePerfilesZ8 && window._cachePerfilesZ8[idDestino]) || {};
    const dotColor = p.estadoActual === 'Conectado' ? '#22c55e' : (p.estadoActual === 'Descanso' ? '#3b82f6' : (p.estadoActual === 'Pausado' ? '#f59e0b' : '#64748b'));
    return `
        <div class="relative inline-flex shrink-0" style="width:${sizePx}px;height:${sizePx}px;">
            ${renderAvatarHTMLZ8(idDestino, sizePx)}
            <span style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:9999px;background:${dotColor};border:2px solid #141416;"></span>
        </div>
    `;
}

function obtenerUltimoMensajeConversacionZ8(idConversacion, miUsuario) {
    for (let i = _mensajesChatZ8.length - 1; i >= 0; i--) {
        const m = _mensajesChatZ8[i];
        if (esMensajeVisibleEnConversacionZ8(m, idConversacion, miUsuario)) {
            return m;
        }
    }
    return null;
}

function formatearHoraCortaSidebarZ8(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        const hoy = new Date();
        const esHoy = d.toDateString() === hoy.toDateString();
        if (esHoy) {
            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        return 'Ayer';
    } catch (e) { return ''; }
}

function seleccionarConversacionChatZ8(destino) {
    _conversacionActivaZ8 = destino;
    _noLeidosChatZ8[destino] = 0;
    actualizarBadgesNoLeidosChatZ8();

    const titleEl = document.getElementById('chat-header-title-z8');
    const subEl = document.getElementById('chat-header-sub-z8');
    const avatarEl = document.getElementById('chat-header-avatar-z8');
    const actionsEl = document.getElementById('chat-header-actions-z8');

    if (avatarEl) avatarEl.innerHTML = renderAvatarCanalOAgenteZ8(destino, 38);

    const canal = CANALES_EQUIPO_Z8.find(c => c.id === destino);
    if (canal) {
        if (titleEl) titleEl.textContent = canal.nombre;
        if (subEl) {
            subEl.className = "text-[11px] text-emerald-500 font-semibold flex items-center gap-1.5";
            subEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span><span>${canal.desc}</span>`;
        }
        if (actionsEl) actionsEl.innerHTML = '';
    } else {
        const p = (window._cachePerfilesZ8 && window._cachePerfilesZ8[destino]) || {};
        const est = p.estadoActual || 'Sin conexión';
        const dotClass = est === 'Conectado' ? 'bg-emerald-500' : (est === 'Descanso' ? 'bg-blue-500' : (est === 'Pausado' ? 'bg-amber-500' : 'bg-slate-400'));
        const textClass = est === 'Conectado' ? 'text-emerald-500' : 'text-slate-400';
        if (titleEl) titleEl.textContent = p.nombreMostrar && p.nombreMostrar !== destino ? `${p.nombreMostrar} (${destino})` : destino;
        if (subEl) {
            subEl.className = `text-[11px] ${textClass} font-semibold flex items-center gap-1.5`;
            subEl.innerHTML = `<span class="w-2 h-2 rounded-full ${dotClass} inline-block"></span><span>${est === 'Conectado' ? 'Activo ahora' : est} · ${p.servicio || (p.rol === 'admin' ? 'Supervisión' : 'Agente')}</span>`;
        }
        if (actionsEl) {
            const btnAlarma = (_contextoUsuarioZ8.rol === 'admin' && typeof dispararAlarmaRapidaAgente === 'function')
                ? `<button type="button" onclick="dispararAlarmaRapidaAgente('${destino}')" class="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white text-sm flex items-center justify-center transition" title="🚨 Enviar alarma sonora a ${destino}">🚨</button>`
                : '';
            actionsEl.innerHTML = `
                ${btnAlarma}
                <button type="button" onclick="abrirModalPerfilZ8('${destino}')" class="w-8 h-8 rounded-lg bg-slate-500/15 hover:bg-slate-600 text-slate-300 hover:text-white text-sm flex items-center justify-center transition" title="👤 Ver ficha de ${destino}">👤</button>
            `;
        }
    }

    renderContactosChatZ8();
    renderMensajesChatZ8();
}

function renderContactosChatZ8() {
    const bar = document.getElementById('chat-contactos-bar-z8');
    if (!bar) return;
    const miUsuario = _contextoUsuarioZ8.usuario;
    const perfiles = window._cachePerfilesZ8 || {};
    const filtro = ((document.getElementById('chat-sidebar-search-z8') || {}).value || '').trim().toLowerCase();

    const usuarios = Object.keys(perfiles).filter(u => u !== miUsuario).sort((a, b) => {
        const rolA = perfiles[a].rol === 'admin' ? 0 : 1;
        const rolB = perfiles[b].rol === 'admin' ? 0 : 1;
        if (rolA !== rolB) return rolA - rolB;
        return a.localeCompare(b);
    });

    let html = `<div class="px-2.5 pt-1 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Canales de Equipo</div>`;

    for (const c of CANALES_EQUIPO_Z8) {
        const ult = obtenerUltimoMensajeConversacionZ8(c.id, miUsuario);
        const previewTxt = ult
            ? (ult.texto ? `${ult.emisor}: ${ult.texto}` : `${ult.emisor} envió un GIF`)
            : c.desc;
        if (filtro && !c.nombre.toLowerCase().includes(filtro) && !previewTxt.toLowerCase().includes(filtro)) continue;

        const activo = _conversacionActivaZ8 === c.id;
        const unread = _noLeidosChatZ8[c.id] || 0;
        const hora = ult ? formatearHoraCortaSidebarZ8(ult.creadoEn) : '';

        html += `
            <div onclick="seleccionarConversacionChatZ8('${c.id}')" class="z8-chat-item flex items-center gap-3 px-3 py-2.5 ${activo ? 'active' : ''}">
                ${renderAvatarCanalOAgenteZ8(c.id, 38)}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-bold truncate">${escaparHTMLZ8(c.nombre)}</span>
                        <span class="text-[10px] text-slate-400 shrink-0">${hora}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2 mt-0.5">
                        <span class="text-[11px] text-slate-400 truncate">${escaparHTMLZ8(previewTxt)}</span>
                        ${unread > 0 ? `<span class="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-extrabold shrink-0">${unread}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    html += `<div class="px-2.5 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Mensajes Directos</div>`;

    for (const u of usuarios) {
        const p = perfiles[u] || {};
        const ult = obtenerUltimoMensajeConversacionZ8(u, miUsuario);
        const previewTxt = ult
            ? (ult.texto ? ult.texto : '📷 GIF animado')
            : `${p.servicio || (p.rol === 'admin' ? 'Supervisión' : 'Agente')} · ${p.estadoActual || 'Sin conexión'}`;
        const nombreVisible = p.rol === 'admin' ? `🛡️ ${u}` : u;

        if (filtro && !u.toLowerCase().includes(filtro) && !(p.nombreMostrar || '').toLowerCase().includes(filtro) && !previewTxt.toLowerCase().includes(filtro)) continue;

        const activo = _conversacionActivaZ8 === u;
        const unread = _noLeidosChatZ8[u] || 0;
        const hora = ult ? formatearHoraCortaSidebarZ8(ult.creadoEn) : '';

        html += `
            <div onclick="seleccionarConversacionChatZ8('${u}')" class="z8-chat-item flex items-center gap-3 px-3 py-2.5 ${activo ? 'active' : ''}">
                ${renderAvatarCanalOAgenteZ8(u, 38)}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-bold truncate">${escaparHTMLZ8(nombreVisible)}</span>
                        <span class="text-[10px] text-slate-400 shrink-0">${hora}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2 mt-0.5">
                        <span class="text-[11px] text-slate-400 truncate">${escaparHTMLZ8(previewTxt)}</span>
                        ${unread > 0 ? `<span class="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-extrabold shrink-0">${unread}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    bar.innerHTML = html;
}

function renderMensajesChatZ8() {
    const feed = document.getElementById('chat-mensajes-feed-z8');
    if (!feed) return;
    const miUsuario = _contextoUsuarioZ8.usuario;
    const lista = _mensajesChatZ8.filter(m => esMensajeVisibleEnConversacionZ8(m, _conversacionActivaZ8, miUsuario));

    if (lista.length === 0) {
        feed.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 text-xs">
                <div class="text-2xl mb-2">💬</div>
                <div class="font-bold">No hay mensajes aún en esta conversación</div>
                <div class="text-[11px] text-slate-500 mt-1">Escribe abajo o envía un emoji 😊 o GIF animado</div>
            </div>
        `;
        return;
    }

    let html = `
        <div class="flex justify-center my-1">
            <span class="px-3 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400">Hoy</span>
        </div>
    `;
    const mostrarNombreEmisor = esCanalGrupalZ8(_conversacionActivaZ8);

    for (const m of lista) {
        const esMio = m.emisor === miUsuario;
        let horaStr = '';
        try {
            const d = new Date(m.creadoEn);
            horaStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {}

        const p = (window._cachePerfilesZ8 && window._cachePerfilesZ8[m.emisor]) || {};
        const tagAdmin = (m.rolEmisor === 'admin' || p.rol === 'admin')
            ? `<span class="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-400 text-[9px] font-extrabold ml-1">SUPERVISIÓN</span>`
            : '';

        const textoSeguro = escaparHTMLZ8(m.texto || '');
        const gifHtml = m.gifUrl
            ? `<div class="mt-1.5"><img src="${escaparHTMLZ8(m.gifUrl)}" alt="GIF" class="rounded-xl max-h-40 object-contain bg-black/20"></div>`
            : '';

        if (esMio) {
            html += `
                <div class="flex items-end justify-end gap-2">
                    <div class="max-w-[75%] z8-bubble-out px-3.5 py-2.5 shadow-sm">
                        ${textoSeguro ? `<div class="break-words leading-relaxed text-[12px]">${textoSeguro}</div>` : ''}
                        ${gifHtml}
                        <div class="text-[10px] opacity-60 text-right mt-1 flex items-center justify-end gap-1">
                            <span>${horaStr}</span>
                            <span>✓✓</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="flex items-end gap-2.5">
                    ${renderAvatarHTMLZ8(m.emisor, 28)}
                    <div class="max-w-[75%] z8-bubble-in px-3.5 py-2.5 shadow-sm">
                        ${mostrarNombreEmisor ? `<div class="text-[10px] font-extrabold text-blue-400 mb-0.5 flex items-center">${escaparHTMLZ8(m.emisor)}${tagAdmin}</div>` : ''}
                        ${textoSeguro ? `<div class="break-words leading-relaxed text-[12px]">${textoSeguro}</div>` : ''}
                        ${gifHtml}
                        <div class="text-[10px] opacity-50 mt-1">${horaStr}</div>
                    </div>
                </div>
            `;
        }
    }

    feed.innerHTML = html;
    feed.scrollTop = feed.scrollHeight;
}

function toggleEmojiPickerZ8() {
    const em = document.getElementById('chat-emoji-picker-z8');
    const gf = document.getElementById('chat-gif-picker-z8');
    if (gf) gf.classList.add('hidden');
    if (em) em.classList.toggle('hidden');
}

function toggleGifPickerZ8() {
    const em = document.getElementById('chat-emoji-picker-z8');
    const gf = document.getElementById('chat-gif-picker-z8');
    if (em) em.classList.add('hidden');
    if (gf) {
        gf.classList.toggle('hidden');
        if (!gf.classList.contains('hidden')) {
            const inp = document.getElementById('chat-gif-search-z8');
            if (inp) inp.focus();
        }
    }
}

function insertarEmojiChatZ8(emoji) {
    const inp = document.getElementById('chat-input-txt-z8');
    if (!inp) return;
    inp.value += emoji;
    inp.focus();
}

let _giphySearchTimerZ8 = null;

function filtrarCatalogoGifsZ8() {
    const grid = document.getElementById('chat-gif-grid-z8');
    const inp = document.getElementById('chat-gif-search-z8');
    if (!grid) return;
    const q = (inp ? inp.value : '').trim().toLowerCase();
    const locales = !q
        ? CATALOGO_GIFS_Z8
        : CATALOGO_GIFS_Z8.filter(g => g.title.toLowerCase().includes(q) || g.tags.toLowerCase().includes(q));

    const renderItems = (items) => {
        if (!items || items.length === 0) {
            grid.innerHTML = `<div class="col-span-4 text-center py-4 text-[11px] text-slate-400">Buscando GIFs...</div>`;
            return;
        }
        grid.innerHTML = items.map(g => `
            <button type="button" onclick="enviarGifChatZ8('${g.url}')" class="p-1 rounded-lg bg-white border border-slate-200 hover:border-blue-500 flex flex-col items-center justify-center transition group overflow-hidden" title="${escaparHTMLZ8(g.title)}">
                <img src="${g.url}" alt="${escaparHTMLZ8(g.title)}" class="w-14 h-12 object-cover rounded group-hover:scale-105 transition">
                <span class="text-[9px] text-slate-500 truncate w-full text-center mt-0.5">${escaparHTMLZ8((g.title || 'GIF').split('/')[0])}</span>
            </button>
        `).join('');
    };

    renderItems(locales);

    if (_giphySearchTimerZ8) clearTimeout(_giphySearchTimerZ8);
    if (q.length >= 2) {
        _giphySearchTimerZ8 = setTimeout(async () => {
            try {
                const resp = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=GlVGYHkr3WSBnllca54iNt0yFbjz7L65&q=${encodeURIComponent(q)}&limit=16&rating=g&lang=es`);
                if (!resp.ok) return;
                const json = await resp.json();
                const remotos = (json.data || []).map(d => ({
                    title: d.title || q,
                    url: (d.images && d.images.fixed_height_small && d.images.fixed_height_small.url) || (d.images && d.images.downsized && d.images.downsized.url) || ''
                })).filter(x => x.url);
                if (remotos.length > 0) {
                    renderItems([...locales, ...remotos]);
                }
            } catch (e) {}
        }, 280);
    }
}

async function enviarGifPorUrlManualZ8() {
    const url = prompt("Pega aquí el enlace directo (.gif o imagen) que quieras enviar al chat:");
    if (!url || !url.trim().startsWith('http')) return;
    await enviarGifChatZ8(url.trim());
}

async function enviarGifChatZ8(gifUrl) {
    const gf = document.getElementById('chat-gif-picker-z8');
    if (gf) gf.classList.add('hidden');
    await enviarMensajeChatInternoZ8('', gifUrl);
}

async function enviarMensajeChatDesdeUIZ8(e) {
    e.preventDefault();
    const inp = document.getElementById('chat-input-txt-z8');
    if (!inp) return;
    const txt = inp.value.trim();
    if (!txt) return;
    inp.value = '';
    const em = document.getElementById('chat-emoji-picker-z8');
    if (em) em.classList.add('hidden');
    await enviarMensajeChatInternoZ8(txt, '');
}

async function enviarMensajeChatInternoZ8(texto, gifUrl) {
    try {
        const res = await fetchGoogleAPI("enviarMensajeChat", {
            emisor: _contextoUsuarioZ8.usuario,
            rolEmisor: _contextoUsuarioZ8.rol,
            destino: _conversacionActivaZ8,
            texto: texto,
            gifUrl: gifUrl
        });
        if (res && res.mensaje) {
            recibirMensajeChatRealtimeZ8(res.mensaje);
        }
    } catch (e) {}
}

function escaparHTMLZ8(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
