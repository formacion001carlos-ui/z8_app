// api.js

const SUPABASE_URL = "https://owjddgjnqhwvyoafhakm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1o-mFgTMNbTvQiXuQ8JIJg_9O7u8inj";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HEARTBEAT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos sin latido = ventana cerrada

async function verificarYCerrarSesionInactiva(vivo) {
    if (!vivo || vivo.estado === "Desconectado" || !vivo.inicio) return { cerrado: false, vivo };

    const refTimeStr = vivo.actualizado_en || vivo.inicio;
    const ultimoLatidoMs = new Date(refTimeStr).getTime();
    const inicioMs = new Date(vivo.inicio).getTime();
    const ahoraMs = Date.now();

    if (isNaN(ultimoLatidoMs) || (ahoraMs - ultimoLatidoMs) <= HEARTBEAT_TIMEOUT_MS) {
        return { cerrado: false, vivo };
    }

    // Si pasaron más de 3 minutos sin latido, cerramos la sesión exactamente en el último latido registrado
    const finEfectivoMs = Math.max(inicioMs, ultimoLatidoMs);
    const finEfectivoISO = new Date(finEfectivoMs).toISOString();

    await supabaseClient.from('maestro').insert({
        usuario: vivo.usuario,
        estado: vivo.estado,
        actividad: vivo.actividad || "",
        inicio: vivo.inicio,
        fin: finEfectivoISO
    });

    await supabaseClient.from('estado_vivo').upsert({
        usuario: vivo.usuario,
        estado: "Desconectado",
        actividad: "",
        inicio: null,
        actualizado_en: finEfectivoISO
    });

    vivo.estado = "Desconectado";
    vivo.actividad = "";
    vivo.inicio = null;
    vivo.autoCerradoPorHeartbeat = true;
    return { cerrado: true, vivo };
}

async function barrerSesionesInactivasGlobal() {
    const { data: vivos } = await supabaseClient
        .from('estado_vivo')
        .select('*')
        .neq('estado', 'Desconectado');
    if (vivos && vivos.length > 0) {
        for (let v of vivos) {
            await verificarYCerrarSesionInactiva(v);
        }
    }
}

async function fetchGoogleAPI(action, payload) {
    if (action === "login") {
        const usr = (payload.usuario || "").trim().toUpperCase();
        const pwd = (payload.password || "").trim();
        
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('rol')
            .eq('nombre', usr)
            .eq('clave', pwd)
            .single();
            
        if (error || !data) return { valido: false };
        return { valido: true, rol: data.rol };
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
            // Si la sesión previa estaba inactiva por cierre de ventana, se corta en su último latido
            const check = await verificarYCerrarSesionInactiva(vivo);
            if (!check.cerrado) {
                await supabaseClient.from('maestro').insert({
                    usuario: usr,
                    estado: vivo.estado,
                    actividad: vivo.actividad,
                    inicio: vivo.inicio,
                    fin: new Date().toISOString()
                });
            }
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

        let autoCerrado = false;
        if (vivo && vivo.estado !== 'Desconectado') {
            const check = await verificarYCerrarSesionInactiva(vivo);
            autoCerrado = check.cerrado;
            // Si sigue activo, renovamos su latido al consultar estado
            if (!autoCerrado) {
                await supabaseClient.from('estado_vivo')
                    .update({ actualizado_en: new Date().toISOString() })
                    .eq('usuario', usr);
            }
        }
            
        // Get user target hours
        const { data: userData } = await supabaseClient
            .from('usuarios')
            .select('horas_objetivo')
            .eq('nombre', usr)
            .single();
        let target = userData ? userData.horas_objetivo : 8;
            
        // Calcular segundos acumulados hoy
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
                horasObjetivo: target,
                autoCerradoPorHeartbeat: autoCerrado
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
            horasObjetivo: target,
            autoCerradoPorHeartbeat: false
        };
    }
    
    if (action === "registroManual") {
        let usr = (payload.usuario || "").trim().toUpperCase();
        let partsD = payload.fecha.split("/");
        let strIni = `${partsD[2]}-${partsD[1]}-${partsD[0]}T${payload.inicio}Z`;
        let strFin = `${partsD[2]}-${partsD[1]}-${partsD[0]}T${payload.fin}Z`;
        
        let dIni = new Date(strIni).toISOString();
        let dFin = new Date(strFin).toISOString();
        
        // Evitar duplicados: comprobar si ya hay un registro que se cruce
        const { data: exist } = await supabaseClient.from('maestro')
            .select('*')
            .eq('usuario', usr)
            .gte('inicio', dIni.substring(0, 10) + 'T00:00:00Z')
            .lte('inicio', dIni.substring(0, 10) + 'T23:59:59Z');
            
        let overlap = false;
        if(exist) {
            for(let r of exist) {
                if(r.inicio === dIni && r.fin === dFin) overlap = true;
            }
        }
        
        if(!overlap) {
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
        await barrerSesionesInactivasGlobal();

        const ahora = new Date();
        const hoyStr = ahora.toISOString().split('T')[0];
        const inicioDia = new Date(hoyStr + "T00:00:00Z").toISOString();
        const finDia = new Date(hoyStr + "T23:59:59Z").toISOString();
        
        const { data: vivos } = await supabaseClient.from('estado_vivo').select('*');
        const { data: fichajesHoy } = await supabaseClient.from('maestro')
            .select('*')
            .gte('inicio', inicioDia)
            .lte('inicio', finDia);
            
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
                
                arr.push({
                    usuario: v.usuario,
                    estado: v.estado,
                    actividad: v.actividad || "-",
                    inicio: inicioStr,
                    horaInicio: inicioStr,
                    horasHoy: horasHoyStr
                });
            }
        }
        return arr;
    }
    
    if (action === "getMonthlySummary") {
        await barrerSesionesInactivasGlobal();
        let ano, mes;
        if (payload.month) {
            const parts = payload.month.split('-');
            ano = parseInt(parts[0], 10);
            mes = parseInt(parts[1], 10) - 1; // 0-indexed
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
        if(usuarios) {
            for(let u of usuarios) {
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
        
        if(fichajes) {
            for (let f of fichajes) {
                let usr = f.usuario;
                if(!matriz[usr]) continue;
                if (esSolicitudNoAprobada(f.estado)) continue;
                
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
        
        // Consolidar totales por usuario asegurando que ningún día quede en negativo
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

        // Obtener todas las solicitudes de este agente
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
        const fecha = payload.fecha; // YYYY-MM-DD
        const tipo = payload.tipo;   // 'sumar' | 'restar' | 'fijar'
        const tiempoSolicitadoSegs = Math.max(0, parseInt(payload.segundos || 0, 10));
        const motivo = (payload.motivo || "").trim();

        if (!usr || !fecha || !motivo) {
            throw new Error("Datos incompletos para la solicitud.");
        }

        // Consultar las horas actuales del agente en esa fecha
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
        // Ordenar: primero pendientes, luego por fecha de creación descendente
        solicitudes.sort((a, b) => {
            if (a.estado === 'SOLICITUD_PENDIENTE' && b.estado !== 'SOLICITUD_PENDIENTE') return -1;
            if (a.estado !== 'SOLICITUD_PENDIENTE' && b.estado === 'SOLICITUD_PENDIENTE') return 1;
            return (b.creadoEn || '').localeCompare(a.creadoEn || '');
        });
        return solicitudes;
    }

    if (action === "resolverSolicitudAdmin") {
        const id = payload.id;
        const decision = payload.decision; // 'APROBAR' | 'RECHAZAR' | 'ELIMINAR'
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

        // Recalcular las horas actuales del día (excluyendo esta misma solicitud)
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
}

function esSolicitudNoAprobada(estado) {
    return estado === 'SOLICITUD_PENDIENTE' || estado === 'SOLICITUD_RECHAZADA';
}

function obtenerSegundosDeFilaMaestro(f) {
    if (!f) return 0;
    if (esSolicitudNoAprobada(f.estado)) return 0;
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
    const urls = ['version.json', 'api.js', window.location.pathname.split('/').pop() || 'index.html'];
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

    // Comprobar automáticamente cada 60 segundos si cambiaron los archivos en el servidor / GitHub Pages
    setInterval(async () => {
        const nuevaFirma = await obtenerFirmaArchivosActuales();
        if (_firmaVersionInicial && nuevaFirma && nuevaFirma !== _firmaVersionInicial) {
            mostrarBannerNuevaVersion();
        }
    }, 60000);

    // Canal en tiempo real para recibir aviso instantáneo si el supervisor pulsa "Notificar actualización"
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

