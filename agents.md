# Agent Guardrails & Guidelines

## 1. Principios de Desarrollo
- **Consistencia**: Siempre usar TypeScript con tipado estricto.
- **Modularidad**: Componentes pequeños y reutilizables en `src/components`.
- **Seguridad**: Reglas de Firestore deben validar que el `userId` coincida con el autor de los datos.

## 2. Instrucciones para la IA
- Antes de implementar cualquier feature, verificar el `PRD.md`.
- No usar datos dummy en producción; integrar Firebase desde el inicio.
- Mantener el diseño responsive (Mobile First).

## 3. Convenciones de Código
- Funciones de flecha para componentes.
- Tailwind para todo el styling (evitar CSS puro).
- Manejo de estados complejos con `useContext` o `useReducer` si es necesario.
