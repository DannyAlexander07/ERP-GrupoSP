// Archivo: backend/src/utils/errors.ts

// Creamos una clase de error personalizada que extiende la clase Error nativa de JavaScript.
// Esto nos permite añadir propiedades extra, como el 'statusCode'.
export class HttpError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message); // Llama al constructor de la clase Error con el mensaje
        this.statusCode = statusCode; // Asigna nuestro código de estado personalizado
        Object.setPrototypeOf(this, HttpError.prototype); // Mantiene la cadena de prototipos
    }
}