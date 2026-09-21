// api.js

const SUPABASE_URL = "https://owjddgjnqhwvyoafhakm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1o-mFgTMNbTvQiXuQ8JIJg_9O7u8inj";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
            
        let segundosHoy = 0;
        if (fichajesHoy) {
            for (let f of fichajesHoy) {
                if (f.fin) {
                    let dIni = new Date(f.inicio);
                    let dFin = new Date(f.fin);
                    segundosHoy += Math.floor((dFin - dIni)/1000);
                }
            }
        }
        
        if (!vivo || vivo.estado === 'Desconectado') {
            return { estado: 'Desconectado', actividad: '', inicio: '-', segundosAcumuladosHoy: segundosHoy };
        }
        
        let di = new Date(vivo.inicio);
        let hh = String(di.getHours()).padStart(2, '0');
        let mm = String(di.getMinutes()).padStart(2, '0');
        let ss = String(di.getSeconds()).padStart(2, '0');
        let inicioStr = `${hh}:${mm}:${ss}`;
        
        return {
            estado: vivo.estado,
            actividad: vivo.actividad || '',
            inicio: inicioStr,
            segundosAcumuladosHoy: segundosHoy
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
                // Si coinciden exactamente, lo bloqueamos
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
                let horasHoySecs = 0;
                if (fichajesHoy) {
                    let userFichajes = fichajesHoy.filter(f => f.usuario === v.usuario && f.fin);
                    for (let f of userFichajes) {
                        let dIni = new Date(f.inicio);
                        let dFin = new Date(f.fin);
                        horasHoySecs += Math.floor((dFin - dIni)/1000);
                    }
                }
                
                let h = Math.floor(horasHoySecs / 3600);
                let m = Math.floor((horasHoySecs % 3600) / 60);
                let s = horasHoySecs % 60;
                let horasHoyStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                
                let inicioStr = "-";
                if (v.inicio) {
                    let di = new Date(v.inicio);
                    let dia = String(di.getDate()).padStart(2, '0');
                    let mes = String(di.getMonth() + 1).padStart(2, '0');
                    let ano = di.getFullYear();
                    let hh = String(di.getHours()).padStart(2, '0');
                    let mm = String(di.getMinutes()).padStart(2, '0');
                    let ss = String(di.getSeconds()).padStart(2, '0');
                    inicioStr = `${dia}/${mes}/${ano} ${hh}:${mm}:${ss}`;
                }
                
                arr.push({
                    usuario: v.usuario,
                    estado: v.estado,
                    actividad: v.actividad || "-",
                    inicio: inicioStr,
                    horasHoy: horasHoyStr
                });
            }
        }
        return arr;
    }
    
    if (action === "getMonthlySummary") {
        const ahora = new Date();
        const ano = ahora.getFullYear();
        const mes = ahora.getMonth(); 
        
        const primerDia = new Date(ano, mes, 1).toISOString();
        const ultimoDia = new Date(ano, mes + 1, 0, 23, 59, 59).toISOString();
        
        const { data: fichajes } = await supabaseClient
            .from('maestro')
            .select('*')
            .gte('inicio', primerDia)
            .lte('inicio', ultimoDia);
            
        const { data: usuarios } = await supabaseClient
            .from('usuarios')
            .select('nombre, horas_objetivo');
            
        let metas = {};
        if(usuarios) {
            for(let u of usuarios) metas[u.nombre] = u.horas_objetivo || 8;
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
              previstas: metas[u] * diasLaborables * 3600,
              horasLaborables: 0,
              horasFinde: 0
           };
        }
        
        if(fichajes) {
            for (let f of fichajes) {
                if(!f.fin) continue;
                let dIni = new Date(f.inicio);
                let dFin = new Date(f.fin);
                let usr = f.usuario;
                if(!matriz[usr]) continue; 
                
                let diffSegundos = Math.floor((dFin.getTime() - dIni.getTime()) / 1000);
                if (diffSegundos < 0) diffSegundos += 86400;
                
                matriz[usr].totalMes += diffSegundos;
                
                let diaDelMes = dIni.getDate();
                matriz[usr].dias[diaDelMes] = (matriz[usr].dias[diaDelMes] || 0) + diffSegundos;
                
                let diaSemana = dIni.getDay();
                if(diaSemana === 0 || diaSemana === 6) {
                    matriz[usr].horasFinde += diffSegundos;
                } else {
                    matriz[usr].horasLaborables += diffSegundos;
                }
            }
        }
        
        return {
            mes: `${(mes+1).toString().padStart(2,'0')}/${ano}`,
            datos: matriz
        };
    }
    
    if (action === "heartbeat") {
        await supabaseClient.from('estado_vivo')
            .update({ actualizado_en: new Date().toISOString() })
            .eq('usuario', (payload.usuario || "").trim().toUpperCase());
        return { success: true };
    }
}
