# Noche de Vellmoor

Juego de acción de horror gótico victoriano con horror cósmico: un modo por niveles con jefes y un modo libre survivor.
Sos un cazador en la ciudad maldita de Vellmoor y tenés que sobrevivir 10 minutos, hasta el amanecer,
mientras la luna se tiñe de rojo. Todo el arte se genera con formas en Canvas; los nombres y el diseño son originales.

## Cómo jugar
- Abrí `index.html` con doble clic (o el acceso directo del escritorio), **o** corré `node servir.cjs` y entrá a http://localhost:5178
- **WASD / flechas**: moverse · el disparo y el cuerpo a cuerpo son automáticos
- **Espacio**: transformar el arma cuerpo a cuerpo
- **Shift**: esquiva rápida (gasta 25 de aguante, breve invulnerabilidad)
- **Q**: vial curativo (cura 40% de la vida; empezás con 5, máximo 20)
- **R**: balas de sangre (sacrificás 30% de la vida por 5 balas; esa vida se puede recuperar contraatacando)
- **E**: arte oculta equipada (gasta balas)
- **F**: usar el objeto elegido del cinturón · **C**: cambiar de objeto
- **T**: tienda del velo (se paga con Lucidez)
- **1 / 2 / 3** (o 4) o clic: elegir mejora al subir de nivel
- **P / Esc**: pausa · **M**: sonido · **Enter / R**: reintentar

## El Refugio del Farolero (entre partidas)
Desde el menú se entra al refugio; desde ahí salís al **modo normal** o a **salir de cacería**. Al terminar podés volver al refugio (Enter) o repetir el mismo modo (R).
El progreso se guarda solo en el navegador (localStorage).

- **Esencia ◈**: la ganás matando (más con élites, variantes de la Luna de sangre y el jefe final).
  Al **amanecer** conservás toda y +25%. Si **morís**, conservás la mitad y la otra mitad queda como **rastro de sangre**
  en la siguiente cacería (una flecha roja te guía). Si no lo recuperás en esa partida, se pierde para siempre.
- **Fragmentos ◆**: los sueltan los élites (2), el Heraldo (3) y el jefe final (6). Se conservan siempre.
- **Atributos** (se pagan con esencia, cada punto cuesta más):
  Vitalidad (+8 vida) · Aguante (+6 aguante y recuperación) · Fuerza (+4% cuerpo a cuerpo) · Destreza (+4% armas de fuego) ·
  Sangre (+1 munición máx. y +3% vida recuperada) · Arcano (+4% artes y herramientas, más suerte).
- **Armas**: cada arma se desbloquea la primera vez que la equipás en una cacería. En el refugio elegís con cuál empezar
  y la mejorás de **+1 a +10** con fragmentos (+6% de daño por nivel).
- **Provisiones** para la próxima salida: viales extra, cócteles, sedantes y la **Campana de llamada**.
- **Registro**: cacerías, amaneceres, mejor tiempo, bestias abatidas, jefes cazados, y la opción de borrar el progreso.

## Dificultad
Se elige en la pestaña **Modo normal** del refugio y vale para los dos modos. La predeterminada es **Pesadilla**.

| | Cazador | Pesadilla | Sangre de luna |
|---|---|---|---|
| Vida / daño enemigo | ×1,25 / ×1,3 | ×1,6 / ×1,6 | ×2 / ×2 |
| Velocidad enemiga | +8% | +15% | +22% |
| Cantidad de enemigos | +15% | +30% | +45% |
| IA (modo normal) | según el nivel | +1 escalón | +3 escalones (máxima casi de entrada) |
| Élites | desde el nivel 3 | desde el 1, el doble de frecuentes | desde el 1, el triple, siempre con dos afijos |
| Invulnerabilidad tras un golpe | 0,42 s | 0,32 s | 0,25 s |
| Vida recuperable | dura poco | dura menos | casi nada |
| Golpe cuerpo a cuerpo automático | 15% más lento | 30% más lento | 45% más lento |
| Curación al pasar de nivel | 8% | 4% | ninguna |
| Viales iniciales (modo normal) | 3 | 2 | 1 |
| Proyectiles enemigos | +10% velocidad | +20% | +30% |
| Esencia | ×1 | ×1,6 | ×2,4 |

### IA de los enemigos (modo normal)
- **Búsqueda de caminos**: un *mapa de flujo* (Dijkstra desde tu posición sobre una grilla del mapa) se recalcula 4 veces por segundo.
  Cuando no te ven, todos siguen la ruta más corta hacia vos por cualquier laberinto; los tiradores la usan para buscarte línea de tiro.
- **Rodean de verdad**: cada enemigo cuerpo a cuerpo toma un puesto distinto alrededor tuyo, así te cierran por varios lados a la vez.
- **Esquivan tus balas** con un paso lateral (más seguido cuanto más alta la IA).
- **Asaltos coordinados** (IA 3+): cada tanto todos los cuerpo a cuerpo se enfurecen y cargan juntos ("¡Asalto!").
- Si alguno queda trabado, cambia de lado y, si sigue sin avanzar, reaparece flanqueándote.

## Modos de juego
Desde el refugio elegís entre dos modos:

### Modo normal (por niveles)
- Cada nivel es un **mapa cerrado** con obstáculos. Ganás cuando no queda ningún enemigo.
- Al superar un nivel **recuperás 12% de vida** y **elegís una pieza de equipo** entre 3: mejorar o cambiar tu arma de fuego,
  mejorar o cambiar tu arma cuerpo a cuerpo (las armas suben hasta nivel 8), o una pieza de atuendo.
  En este modo no hay experiencia: se progresa solo con equipo (y con lo que mejores en el refugio).
- Después aparece una puerta arriba: caminá hasta ella para pasar al siguiente nivel.
- **La IA mejora cada 4 niveles**: 1 · persiguen · 2 · se abren para rodearte y embisten más seguido · 3 · los tiradores apuntan adonde vas a estar · 4 · más rápidos y con cargas más cortas.
- **Enemigos con patrones** (todos avisan antes de atacar; cada uno pide una respuesta distinta):

| Enemigo | Desde | Qué hace | Cómo enfrentarlo |
|---|---|---|---|
| Aldeano poseído / Sabueso | 1 | Te persiguen (el sabueso embiste) | Cuerpo a cuerpo y disparo de contra |
| Fanático de la pólvora | 2 | Corre hacia vos, enciende la mecha (parpadea) y estalla; también estalla al morir | Matalo de lejos o esquivá; su explosión lastima a los demás enemigos |
| Aldeano incendiario | 3 | Arroja botellas en llamas (círculo naranja) | Salí del círculo |
| Monje de la campana | 3 | Alza la campana (anillo violeta que se cierra) y suelta un **anillo de orbes**; desde IA 2 rebotan en las paredes, con IA 4 son dos anillos | Buscá un hueco del anillo o cubrite |
| Vigilante con mosquete | 4 | Línea roja punteada y disparo | Cubrite detrás de casas, muros o columnas |
| Escudero con pavés | 4 | Bloquea las balas de frente y reduce los golpes; gira despacio | **Flanquealo** o usá explosiones y trampas |
| Bestia / Escupidor de bilis | 5 | Embestidas / **abanico** de bilis venenosa | Esquivá entre los proyectiles |
| Ballestero de la guardia | 7 | Mira roja continua que te sigue y un **virote** muy rápido y fuerte | Rompé la línea de visión antes de que dispare |
| Bestia saltadora | 7 | Marca dónde va a caer y salta | Salí del círculo |
| Sacerdote de sangre | 9 | Se queda atrás y **cura y enfurece** a los enemigos cercanos (hilos rojos) | **Matalo primero** |

- **Élites con afijos** (desde el nivel 4, más frecuentes cuanto más avanzás; dos afijos desde el 18): más grandes, con contorno dorado,
  el doble de vida y una o dos mejoras: **Blindado** (barra amarilla de armadura que absorbe el daño; mientras dure no se lo
  puede empujar ni aturdir), **Veloz**, **Vampírico** (se regenera y se cura al golpearte), **Explosivo** (estalla al morir),
  **Escudado** (burbuja de inmunidad 2 s cada 6 s) y **Divisor** (se parte en dos al morir). Dan más esencia y a veces una gema.
- **Mapas**: cada nivel combina una **plantilla** (abierto, corredores, cruz, anillo de columnas o laberinto) con el decorado de su zona:
  - **Cobertura total** (casas, mausoleos, muros, columnas, árboles): frena el paso y las balas.
  - **Cobertura parcial** (tumbas, bancos, carros): frena el paso pero no las balas.
  - **Cajas** que se rompen a balazos y golpes (tuyos y de ellos) y **barriles explosivos** que estallan y lastiman a todos.
  - **Trampas** que lastiman mucho más a los enemigos que a vos: **pinchos** que avisan en rojo y salen cada 3 s,
    **braseros** que escupen un anillo de fuego y **pantanos** que frenan y envenenan. Atraé a los enemigos hacia ellas.
- **Dificultad**: muchos más enemigos por nivel, más vida y daño, y la IA sube un escalón cada 4 niveles (ver la sección *Dificultad*).
- **Cada 6.º nivel es un jefe** (6, 12, 18, 24, 30, y vuelven a rotar). Vencerlo abre un **punto de partida**: en la pestaña
  *Modo normal* del refugio podés empezar en el nivel 7, 13, 19… eligiendo antes la mitad de esos niveles en piezas de equipo.
- Al morir (o al abandonar desde la pausa) se aplican las reglas de la esencia de siempre.

| Nivel | Jefe | Inspiración | Cómo pelea |
|---|---|---|---|
| 6 | **El Cazador Caído** | el cazador que se vuelve bestia | Pistolazos en abanico y hachazos; a la mitad pierde su humanidad: bestia más grande, zarpazos a su alrededor y embestidas seguidas |
| 12 | **El Hambre del Matadero** | la bestia hambrienta y venenosa | Embestidas frenéticas y charcos de sangre envenenada (círculos verdes); sus golpes envenenan |
| 18 | **La Penitente de Ceniza** | la gran bestia que reza para curarse | Saltos aplastantes; al 40% y al 15% **se arrodilla a rezar**: hacele mucho daño rápido para interrumpirla y aturdirla, o se cura un 25% |
| 24 | **La Durmiente del Lago** | la criatura lunar que invoca crías | Lluvia de meteoros arcanos, se hunde y reaparece en otro lugar rodeada de larvas |
| 30 | **El Señor del Eclipse** | la presencia final que te roba la sangre | Al presentarse **te deja con 30% de vida**; anillos de orbes, rayos que cruzan el mapa e invocación de horrores |

### Salir de cacería (modo libre)
La noche survivor de siempre: 10 minutos hasta el amanecer, con experiencia y mejoras al subir de nivel, grietas, fases de la noche
y la Bestia del Campanario Rojo a las 9:00.

## Combate
- **Arma de fuego**: dispara balas solo cuando una bestia entra en el **radio de detección** (círculo punteado, se pone rojo al detectar).
  **Gasta munición** (máximo 20): se funde una bala cada 2 s, las bestias sueltan balas y con R fabricás balas de sangre.
  Sin balas no dispara.
- **Aguante**: barra verde bajo la vida; se gasta al esquivar y se recupera solo.
- **Viales**: los sueltan algunos enemigos (los élites siempre sueltan 3).
- **Arma cuerpo a cuerpo**: cuando una bestia se acerca demasiado, el cazador la golpea solo. Los tajos también cortan los orbes enemigos.
- **Herramientas** (hasta 3, nivel 1 a 5): Faroles errantes, Campana del vigía, Frascos de brea.
- **Armas que se transforman**: cada arma cuerpo a cuerpo tiene dos formas (A/B) y alternás con **Espacio**. El primer golpe
  después de transformar hace +50% de daño con un arco más amplio.
- **Embestidas y disparo de contra**: sabuesos, bestias, colosos, engendros y el Heraldo cargan una embestida (brillan en rojo con un "!").
  Si una bala los toca durante la carga quedan **aturdidos**; el arma de fuego prioriza a quien está cargando.
- **Golpe visceral**: el siguiente golpe cuerpo a cuerpo a un aturdido hace ×3 de daño y recupera mucha vida.
- **Vida recuperable**: parte del daño recibido queda en naranja en la barra de vida. Si contraatacás enseguida
  la recuperás (sobre todo con golpes cuerpo a cuerpo); si no, se esfuma.

| Arma cuerpo a cuerpo | Forma A | Forma B |
|---|---|---|
| Cuchillo de carnicero | Cuchillo | Machete desplegado |
| Hacha de leñador | Hacha corta | Hacha de asta larga (barrido amplio) |
| Estoque de plata | Estoque | Maza envainada (mucho empuje) |
| Guadaña ritual | Hoz doble | Guadaña desplegada (círculo completo) |
| Espadón del eclipse | Espada envainada | Espadón liberado (lanza ondas de luz) |

## Atuendos y amuletos
- **Atuendos por piezas**: cabeza, torso, brazos y piernas. Cada pieza da un cuarto de las resistencias de su conjunto
  y se pueden mezclar. Con las **4 piezas del mismo conjunto** se activa su bonus (velocidad, regeneración o Lucidez).
  Las mejoras de nivel suelen ofrecerte piezas que te faltan de un conjunto empezado.
  Resistencias: física (bestias), arcana (orbes) y abismal (horrores). Conjuntos:
  Capote de sereno (común), Gabán de rastreador (poco común, +velocidad), Hábito de la capilla (raro, regeneración),
  Coraza del vigía de hierro (legendario, −velocidad) y Velo del observatorio (mítico, +3 Lucidez).
- **Amuletos grabados**: 3 ranuras con rareza. Si están llenas, elegís cuál sacar o descartás el nuevo.
  Sello de la marea (vida recuperada), del juramento (armas de fuego), de la hoja roja (cuerpo a cuerpo), del aliento (velocidad),
  de la sangre fría (visceral y aturdimiento), del estudioso (experiencia), del plenilunio (regeneración) y del ojo velado (daño contra horrores).

### Apariencia de cada atuendo
El cazador se dibuja por capas según la pieza que lleva en **cabeza, torso, brazos y piernas**, así que las mezclas se ven tal cual
(por ejemplo, chistera con coraza y botas del velo). Con el conjunto completo aparece un halo a sus pies del color de la rareza.

| Conjunto | Cabeza | Torso | Brazos | Piernas |
|---|---|---|---|---|
| Ropa de viaje | Gorra y bufanda roja | Abrigo corto marrón | Mangas de lana, manos descubiertas | Pantalón y botas cortas |
| Capote de sereno | Sombrero redondo de ala ancha | Capote gris azulado con esclavina doble y botones | Guantes negros | Botas altas con hebilla |
| Gabán de rastreador | Chistera con cinta | Gabán abierto, chaleco con hebillas, correa y cadena de reloj | Brazales labrados | Botas de montar |
| Hábito de la capilla | Capucha honda con el rostro en sombra | Hábito claro con estola y cordón | Mangas acampanadas | Calzado de tela |
| Coraza del vigía de hierro | Yelmo cerrado con visera | Escamas de hierro y capa carmesí deshilachada | Brazales de hierro | Grebas |
| Velo del observatorio | Capucha alta en punta con velo estrellado | Manto de plumas negras con cadenas | Mangas de plumas | Botas negras con hebillas de plata |

## Gemas
Las sueltan los élites (siempre una) y, a veces, las variantes de la Luna de sangre y los acechadores. Al juntarla elegís
en qué ranura engarzarla: **2 para el arma de fuego y 2 para el cuerpo a cuerpo**. Las ranuras son de la categoría,
así que si cambiás de arma, las gemas se quedan.

| Gema | Efecto (Común → Mítico) |
|---|---|
| 🔶 Filo | +6 → +32% daño del arma |
| 🟤 Cazador | +10 → +50% contra bestias |
| 🟣 Votiva | +10 → +50% contra horrores |
| 🔵 Marea | +15 → +90% vida recuperada con esa arma |
| ⚪ Pulso | −4 → −20% recarga |
| 🟢 Ponzoñosa | Cada golpe acumula 8 → 36 de veneno; al llegar a 100 el enemigo pierde vida durante 5 s |
| 🔴 Ígnea / 🟡 Tormenta / 💠 Arcana | Convierte el daño en Fuego / Rayo / Arcano y +5 → +24% daño |

## Artes ocultas (E)
Una equipada a la vez, sube hasta nivel 3 (+35% poder, −15% recarga por nivel) y se fortalece con la Lucidez.
Salen en las mejoras o en la tienda.

| Arte | Rareza | Costo | Efecto |
|---|---|---|---|
| 🐺 Rugido bestial | Común | 2 balas | Onda que daña, aparta y disuelve orbes |
| 🎶 Caja de música rota | Poco común | 2 balas | Aturde a bestias y humanos cercanos |
| 🦑 Llamado de las profundidades | Raro | 1 bala | Tentáculos arcanos brotan frente a vos |
| 🪶 Pluma del viento | Legendario | 1 bala | 8 s de esquivas invisibles, más largas y baratas, +25% velocidad |
| 🌠 Andanada estelar | Mítico | 3 balas | Ocho proyectiles arcanos que persiguen enemigos |

## Cinturón de objetos (F / C)
🍾 Cóctel incendiario (charco de fuego) · 🗡 Cuchillos arrojadizos (dentados) · 🧴 Cóctel apestoso (atrae a los enemigos comunes
8 s) · 🧧 Papel ígneo / 🎫 Papel de tormenta (30 s de Fuego/Rayo y +20% daño) · 💊 Sedante (cura locura y veneno, 10 s de calma) ·
🫀 Sangre de bestia (30 s de bestialidad) · 🛎️ Campana de llamada (un cazador aliado azulado pelea a tu lado 30 s, con disparos
y tajos). Los sueltan los enemigos; empezás con 2 cócteles y 1 sedante (más lo que compres en el refugio).

## Estados alterados
- **Locura** (barra violeta sobre la cabeza): sube cerca de los horrores y con los orbes, más rápido cuanta más Lucidez tengas.
  Al llenarse te saca 35% de la vida + 15. Se cura con el sedante.
- **Veneno** (barra verde): las larvas abisales lo transmiten; al llenarse perdés 3 de vida por segundo durante 6 s.
- **Bestialidad**: +40% daño cuerpo a cuerpo, +1% por cada golpe (hasta +80%), pero recibís +30% daño.

## Lucidez completa
- Con **Lucidez 10+** ves a los **Acechadores del velo**: horrores que aparecen desde los 2:00. Sin Lucidez son invisibles,
  tu arma de fuego no los apunta (el cuerpo a cuerpo sí los golpea) y te llenan la locura rápido. Con 5+ se ve una leve distorsión.
- **Tienda del velo (T)**: gastá Lucidez en viales, balas, cócteles, sedantes, papeles, gemas raras o artes ocultas.
  Gastarla baja su bonus de daño y suerte, pero también calma a los horrores.

## Tipos de daño y debilidades
Cada arma (y cada forma de las transformables) tiene un tipo de daño. El número sale **amarillo** si golpeás una debilidad
y **gris** si el enemigo lo resiste.

| Familia | Débil a | Resiste |
|---|---|---|
| Humanos (aldeanos) | ✝ Bendito ×1,4 · 🔥 Fuego ×1,2 | — |
| Bestias | 🔥 Fuego ×1,5 · 🦷 Dentado ×1,35 | ✝ Bendito ×0,85 |
| Horrores cósmicos | ⚡ Rayo ×1,5 · ✝ Bendito ×1,15 | 🔥 Fuego ×0,8 · ✴ Arcano ×0,6 |

Armas de fuego: Pistola de chispa 🔥 · Revólver de plata ✝ · Escopeta recortada 🦷 · Carabina ⚔ · Trueno de éter ⚡.
Cuerpo a cuerpo (A / B): Cuchillo ⚔/🦷 · Hacha ⚔/🦷 · Estoque ✝/⚔ · Guadaña 🦷/✴ · Espadón ✝/⚡.
Herramientas: Faroles 🔥 · Campana ✝ · Frascos 🔥.

## Fases de la noche y jefes
- **Atardecer** (0:00–3:20) · **Noche cerrada** (3:20–6:40, bestias más duras y rápidas) · **Luna de sangre** (6:40–10:00):
  variantes rojas deformes más fuertes que embisten más seguido, aparece la **Bestia desollada** y la pantalla late en rojo.
- **Jefes con dos fases**: al bajar de la mitad de la vida se enfurecen (más rápidos y con ataques nuevos que se ven venir):
  el Coloso astado pisotea el suelo, el Heraldo sin rostro lanza anillos de orbes.
- **Jefe final (9:00): la Bestia del Campanario Rojo**. En su primera fase llama murciélagos; en la segunda hace llover sangre
  sobre vos (círculos rojos que estallan). Si no la cazás, huye al amanecer.

## Rarezas
Común (gris) · Poco común (verde) · Raro (azul) · Legendario (dorado) · Mítico (violeta).

| Arma de fuego | Rareza | Arma cuerpo a cuerpo | Rareza |
|---|---|---|---|
| Pistola de chispa | Común | Cuchillo de carnicero | Común |
| Revólver de plata | Poco común | Hacha de leñador | Poco común |
| Escopeta recortada | Raro | Estoque de plata | Raro |
| Carabina de repetición | Legendario | Guadaña ritual | Legendario |
| Trueno de éter | Mítico | Espadón del eclipse | Mítico |

En cada subida de nivel salen siempre una **mejora** de algo que ya tenés y una **oferta de otra arma**, que puede ser
mejor o peor. Si la aceptás, reemplaza a la actual y empieza en nivel 1; la carta te avisa si su rareza es mayor o menor.
La tercera carta suele ser una reliquia, un amuleto o un atuendo con rareza aleatoria. Las **reliquias** se acumulan sin límite: Corazón de roble, Botas de cuero, Piedra de afilar,
Reloj de bolsillo, Brújula lunar, Amuleto de hueso, Capa de cazador, Catalejo de vigía y Ojo de cristal.
Cuanto mayor es la rareza, más potente es el efecto. La suerte para conseguir rarezas altas sube con la Lucidez y con el paso de la noche.

## Lucidez 👁
- Sube al matar horrores cósmicos, al sobrevivir a cada grieta y con el Ojo de cristal.
- Cada punto da +2% de daño y más suerte con las rarezas, **pero** los horrores se vuelven más resistentes.
- A partir de 5 empezás a ver ojos en la oscuridad; a partir de 15 los horrores se cuelan aunque no haya grieta.

## Enemigos
- **La ciudad**: Aldeano poseído, Sabueso famélico, Murciélago de campanario, Bestia de la niebla, Bestia desollada (Luna de sangre) y el Coloso astado (élite cada 2 minutos). Turbas que te rodean a los 3, 5 y 7 minutos.
- **Grietas del abismo**: aproximadamente cada 95 s (la primera al 1:15) la realidad se desgarra durante 22 s y salen horrores cósmicos:
  Larva abisal (en enjambre), Ojo errante (mantiene la distancia y dispara orbes) y Engendro tentacular. En una de cada dos grietas aparece el **Heraldo sin rostro**, un jefe que invoca larvas.

## Gráficos
Todo el arte se dibuja con código (sin imágenes ni librerías), así el juego sigue funcionando con doble clic y sin internet.
- **Iluminación dinámica**: la oscuridad cubre el mapa y la recortan las luces reales: tu farol (titila), las antorchas de los aldeanos, farolas, velas, ventanas, braseros, fuego, disparos, orbes, explosiones, portales y la puerta. Cada luz suma además un resplandor de color.
- **Sprites con contorno** para leerse sobre cualquier fondo; el cazador tiene **ciclo de caminata**, respira al estar quieto y se inclina al moverse; los enemigos rebotan al andar, se aplastan al recibir golpes y se tensan al cargar.
- **Pisos propios de cada zona**: empedrado, pasto y tierra, baldosas de mármol, musgo con hojas y raíces, y tejido orgánico en la Pesadilla.
- **Volumen**: casas con tejado, puerta y ventanas encendidas; muros de ladrillo, columnas cilíndricas, árboles con copa en capas, cajas y barriles con cara frontal y tapa, braseros con llamas.
- **Atmósfera**: manchas de sangre que quedan en el piso, niebla que se arrastra, brasas que suben de los braseros, viñeta, grano de película y una **pausa breve en los golpes fuertes** (viscerales, armaduras rotas, jefes que se enfurecen).

## Archivos
- `index.html`, `style.css`: pantallas (menú, mejoras, pausa, fin de partida)
- `game.js`: todo el juego (lógica, arte generado, sonido sintetizado)
- `servir.cjs`: servidor estático opcional

Para depurar desde la consola: `__vellmoor.skipTo(segundos)`, `__vellmoor.G` (estado de la partida).
