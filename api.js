// api.js

const SUPABASE_URL = "https://owjddgjnqhwvyoafhakm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1o-mFgTMNbTvQiXuQ8JIJg_9O7u8inj";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache local de perfiles para avatares rápidos
window._cachePerfilesZ8 = {};

async function fetchGoogleAPI(action, payload = {}) {
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
