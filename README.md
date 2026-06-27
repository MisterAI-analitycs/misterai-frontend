# MisterAI - Frontend ⚽🤖

Este repositorio contiene la capa de presentación y la interfaz de usuario de **MisterAI**, una plataforma SaaS de análisis táctico automatizado para fútbol base y profesional mediante Visión Artificial. 

El frontend está diseñado siguiendo una arquitectura de *Venture Studio*: una estructura ultra ligera, estática y optimizada para ser desplegada a coste cero en **GitHub Pages**, garantizando velocidad inmediata a pie de campo.

---

## 🚀 Características Principales (Implementadas en UI)

* **Diseño Premium Nativo:** Interfaz responsiva optimizada para smartphones y ordenadores, construida con Tailwind CSS v4 y modo oscuro de alto contraste.
* **Prueba Gratuita de 45 Minutos:** Gancho de captación modificado para permitir el análisis de una parte completa de un partido, asegurando volumen de datos tácticos real para el entrenador.
* **Conversión y Precios Psicológicos:** Sección de tarifas optimizada para volumen y retención con tres niveles definidos:
    * *Partido Individual* (15€ para scouting aislado).
    * *Clubes y Canteras* (39€/mes para cubrir el partido semanal).
    * *Uso Profesional* con la **Oferta de Lanzamiento** activa (44,50€/mes con un 50% de descuento durante un año para los primeros 100 usuarios).
* **Soporte Multidivisa:** Preparado visualmente para operar de manera global a través de la pasarela segura de Stripe.

---

## 🛠️ Stack Tecnológico

* **HTML5 / CSS3:** Estructura semántica con fondos decorativos dinámicos basados en gradientes radiales y líneas de campo de fútbol SVG.
* **Tailwind CSS (v4.x):** Framework de utilidades CSS integrado mediante entorno ágil para un renderizado ultra rápido sin dependencias pesadas.
* **FontAwesome (v6.x):** Kit de iconografía para métricas de rendimiento, mapas de calor y gestión deportiva.

---

## 📂 Estructura del Proyecto

```text
misterai-frontend/
├── index.html          # Landing page principal, propuesta de valor y precios
├── login.html          # Panel de acceso y registro para los entrenadores
├── .gitignore          # Filtro de archivos optimizado para Python, IA y exclusión de vídeos
├── README.md           # Documentación del proyecto (Este archivo)
└── legal/              # Textos de cumplimiento normativo y transparencia
    ├── terminos.html   # Términos de Uso
    ├── privacidad.html # Política de Privacidad
    └── cookies.html    # Política de Cookies