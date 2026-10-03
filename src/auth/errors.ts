/**
 * Error lanzado cuando una solicitud o acción de servidor carece de una sesión autenticada válida (HTTP 401).
 */
export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message = 'Acceso denegado: se requiere una sesión autenticada.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error lanzado cuando existe una sesión válida pero no coincide con el operador autorizado del ERP (HTTP 403).
 */
export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message = 'Acceso prohibido.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
