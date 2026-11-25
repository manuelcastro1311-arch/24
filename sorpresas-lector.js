(() => {
  let borrador = null;
  const tipos = ['text','image','gallery','video','audio','song','quiz','riddle','voucher','link'];
  const crear = (tag, texto, clase) => {
    const e = document.createElement(tag);
    if (texto !== undefined) e.textContent = texto;
    if (clase) e.className = clase;
    return e;
  };
  const estilo = crear('style');
  estilo.textContent = `#contenidoModal .detalle{background:#ffebee;border:1px solid #f4c5cd;border-radius:12px;padding:14px;margin:12px 0;overflow-wrap:anywhere}#contenidoModal .detalle p{margin:0 0 8px;white-space:pre-wrap}#contenidoModal .detalle img,#contenidoModal .detalle video{display:block;max-width:100%;max-height:55vh;margin:8px auto;object-fit:contain}#contenidoModal .detalle audio{width:100%}#contenidoModal .detalle .boton{margin:5px;white-space:normal;max-width:100%;font-size:14px}#contenidoModal .detalle a{display:inline-block;color:#a30c29;margin:8px}#estadoBorrador{font-size:13px;white-space:normal;margin:10px auto;max-width:90%}`;
  document.head.append(estilo);
  const archivo = crear('input');
  archivo.type = 'file'; archivo.accept = '.json,application/json'; archivo.hidden = true;
  const cargar = crear('button','Cargar mis sorpresas','boton');
  const estado = crear('p','Prueba local: el archivo no se publica.');
  estado.id = 'estadoBorrador'; estado.setAttribute('role','status');
  document.querySelector('footer').append(crear('br'),cargar,archivo,estado);
  cargar.onclick = () => archivo.click();
  archivo.onchange = async () => {
    try {
      const d = JSON.parse(await archivo.files[0].text());
      if (!Array.isArray(d) || d.length !== 24 || !d.every(x => x && typeof x.title === 'string' && Array.isArray(x.blocks) && x.blocks.every(b => b && tipos.includes(b.type)))) throw Error('Formato incorrecto');
      borrador = d;
      estado.textContent = 'Borrador cargado: ' + d.filter(x=>x.title || x.blocks.length).length + ' de 24 días preparados. Activa el modo de prueba.';
    } catch(e) { estado.textContent = 'No se pudo cargar. Selecciona un JSON exportado desde el editor.'; }
    finally { archivo.value = ''; }
  };
  function enlace(url) {
    try { const u = new URL(url); return ['http:','https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
  }
  function boton(texto, accion) {const e = crear('button',texto,'boton'); e.type='button'; e.onclick=accion; return e;}
  function multimedia(a, b) {
    const kind = b.type === 'gallery' ? 'image' : b.type;
    const tag = kind === 'image' ? 'img' : kind;
    const media = Array.isArray(b.media) ? b.media : [];
    const agregar = (src) => {
      const e = crear(tag);
      if(tag === 'img') e.alt = b.text || 'Fotografía'; else { e.controls = true; e.preload = 'metadata'; if(tag==='video') e.playsInline = true; }
      e.onerror = () => e.replaceWith(crear('p','No se pudo mostrar este archivo.'));
      a.append(e); e.src = src;
    };
    const re = kind === 'image' ? /^data:image\/(?:png|jpeg|gif|webp|bmp|avif|x-icon);base64,/i : new RegExp('^data:'+kind+'/[a-zA-Z0-9.+-]+;base64,');
    const validos = media.filter(m => m && typeof m.src === 'string' && re.test(m.src));
    validos.forEach(m=>agregar(m.src));
    if(!validos.length || b.type === 'gallery') String(b.url||'').split('\n').forEach(v=>{const u=enlace(v.trim()); if(u){const c=boton('Cargar contenido externo',()=>{c.remove();agregar(u);});a.append(c);}});
  }
  // Publicación cifrada: la clave se recibe exclusivamente en el fragmento del enlace.
  const clave = new URLSearchParams(location.hash.slice(1)).get('clave');
  if (clave) {
    cargar.hidden = true;
    const prueba = document.getElementById('modoPruebaBtn');
    if (prueba) prueba.hidden = true;
    estado.textContent = 'Cargando tus regalos…';
    const botones = Array.from(document.querySelectorAll('.puerta'));
    botones.forEach(b => b.disabled = true);
    (async () => {
      try {
        if (!/^[A-Za-z0-9_-]{43}$/.test(clave)) throw Error('Clave inválida');
        const bytes = Uint8Array.from(atob(clave.replace(/-/g,'+').replace(/_/g,'/')+'='), c=>c.charCodeAt(0));
        const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
        const respuesta = await fetch('./sorpresas-cifradas.bin', {cache:'no-store'});
        if (!respuesta.ok) throw Error('Archivo no disponible');
        const datos = new Uint8Array(await respuesta.arrayBuffer());
        const claro = await crypto.subtle.decrypt({name:'AES-GCM',iv:datos.slice(0,12)},key,datos.slice(12));
        const d = JSON.parse(new TextDecoder().decode(claro));
        if (!Array.isArray(d) || d.length !== 24 || !d.every(x=>x && typeof x.title==='string' && Array.isArray(x.blocks) && x.blocks.every(b=>b && tipos.includes(b.type)))) throw Error('Formato incorrecto');
        borrador = d;
        estado.hidden = true;
        botones.forEach(b => b.disabled = false);
      } catch (e) {
        estado.textContent = 'No se pudieron abrir las sorpresas. Comprueba que el enlace esté completo y que el archivo cifrado esté publicado.';
      }
    })();
  }
  const original = mostrarSorpresa;
  mostrarSorpresa = function(dia) {
    original(dia);
    if (!disponible(dia) || !borrador) return;
    const regalo = borrador[dia-1];
    if (!regalo.title && !regalo.blocks.length) return;
    document.getElementById('tituloModal').textContent = regalo.title || dia+' de diciembre';
    const contenido = document.getElementById('contenidoModal');
    contenido.replaceChildren(crear('p',dia+' de diciembre ♡'));
    regalo.blocks.forEach(b => {
      const a = crear('article',undefined,'detalle');
      if(b.text) a.append(crear('p',b.text));
      if(['image','gallery','video','audio'].includes(b.type)) multimedia(a,b);
      else if(b.type === 'song' || b.type === 'link') {
        const u = enlace(b.url); if(u){const l=crear('a',b.type==='song'?'Escuchar canción ♫':'Abrir enlace'); l.href=u;l.target='_blank';l.rel='noopener noreferrer';a.append(l);}
      } else if(b.type==='riddle') {
        const respuesta=crear('p',''); const c=boton('Ver respuesta',()=>{respuesta.textContent=b.extra||'';c.disabled=true;});a.append(c,respuesta);
      } else if(b.type==='quiz') {
        const r=crear('p','');r.setAttribute('role','status');(Array.isArray(b.options)?b.options:[]).forEach((op,i)=>{if(op) a.append(boton(op,()=>{r.textContent=i===b.correct?'¡Correcto! ♡':'Inténtalo otra vez.';}));});a.append(r);
      } else if(b.type==='voucher') a.append(crear('p',b.extra||''),crear('p','Vale especial ♡'));
      contenido.append(a);
    });
  };
  modal.addEventListener('close',()=>{document.getElementById('contenidoModal').replaceChildren();});
})();
