# Integración Calendario → Mail Composer BEX

## Flujo en la plataforma

1. Al crear una tarea, complete **obligatoriamente**: curso (ID), grupo, asunto y **cuerpo del correo**.
2. El día programado, abra el calendario, seleccione el día y pulse **Abrir Mail Composer (campos listos)**.
3. Se abre el composer con curso, grupo, asunto y cuerpo precargados. **Usted** carga destinatarios y envía cuando quiera.

   Ejemplo de URL (sin envío automático):

   `https://www.gestiondepersonasbex.cl/api/mail_composer.php?key=...&courseid=...&grupo=...&asunto=...&cuerpo=...`

## Activar precarga en el Mail Composer (una sola vez)

El sitio `gestiondepersonasbex.cl` debe cargar un script que lee la URL y rellena los campos.

En `mail_composer.php`, **antes de `</body>`**, agregar (cambie la URL por la de su plataforma en producción):

```html
<script src="http://localhost:3000/mail-composer-prefill.js" defer></script>
```

En producción, por ejemplo:

```html
<script src="https://su-plataforma.vercel.app/mail-composer-prefill.js" defer></script>
```

El archivo está en `frontend/public/mail-composer-prefill.js` de este repositorio.

Sin este paso, el enlace lleva los datos en la URL pero el Mail Composer los muestra vacíos.

## Parámetros de la URL

| Parámetro | Origen en la tarea |
|-----------|-------------------|
| `courseid` / `curso` | Curso (ID Moodle) |
| `grupo` | Nombre del grupo |
| `idgroup` / `grupo_id` | ID de grupo (opcional, más preciso) |
| `asunto` / `subject` | Asunto del correo |
| `cuerpo` / `body` | Cuerpo del correo |
| `autoload=1` | (No se usa desde la plataforma) Evitar: solo precarga de campos |
