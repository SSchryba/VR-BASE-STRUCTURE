# VR Streaming Platform - Production Ready Architecture

A scalable, production-ready VR streaming platform supporting real-time 6DoF rendering, multi-user sessions, and adaptive quality streaming for VR headsets.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin Panel   │    │   User Client   │    │   Monitoring    │
│   (Web Portal)  │    │ (Oculus Quest 3)│    │   Dashboard     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │  (Rate Limiting │
                    │ & Load Balancer)│
                    └─────────────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Authentication  │  │ VR Environment  │  │ Streaming Core  │
│   Service       │  │   Manager       │  │    Engine       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
    │                        │                        │
    └────────────────────────┼────────────────────────┘
                             │
                    ┌─────────────────┐
                    │   Data Layer    │
                    │ (Redis/MongoDB) │
                    └─────────────────┘
```

## 🚀 Features

### Core Capabilities
- **Real-time 6DoF VR Streaming** - 90fps with sub-20ms latency
- **Multi-user Sessions** - Support for 10,000+ concurrent users
- **Adaptive Quality** - Dynamic 4K/2K/1080p/720p based on network conditions
- **Hardware Acceleration** - NVIDIA NVENC and Intel QuickSync support
- **Cross-platform VR Support** - Oculus Quest, HTC Vive, Valve Index

### Enterprise Features
- **Microservices Architecture** - Scalable, fault-tolerant design
- **Kubernetes Native** - Auto-scaling and self-healing
- **Comprehensive Monitoring** - Prometheus, Grafana, ELK stack
- **Security First** - OAuth2, JWT, TLS 1.3, RBAC
- **CI/CD Pipeline** - Automated testing, security scanning, deployment
- **Streaming Core**: The real-time 6DoF rendering and streaming engine.

These services are fronted by an **API Gateway** and communicate via a combination of REST, WebSockets, and a custom UDP protocol.

## Technology Stack

- **Backend**: Node.js, Express.js, Go/Gin
- **Database**: PostgreSQL (Primary), Redis (Cache), InfluxDB (Analytics)
- **Real-time**: WebRTC, Socket.io
- **Infrastructure**: Docker, Kubernetes, Istio
- **Cloud**: AWS / GCP

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
- A monorepo tool like `pnpm` (`npm install -g pnpm`)

### Running the Stack

1.  **Clone the repository:**
    ```bash
    git clone https://your-repo-url/vr-streaming-platform.git
    cd vr-streaming-platform
    ```

2.  **Install dependencies:**
    (pnpm will install dependencies for all services)
    ```bash
    pnpm install
    ```

3.  **Launch the development environment:**
    This command will build the Docker images and start all backend services, databases, and the API gateway.
    ```bash
    docker-compose up --build
    ```

4.  **Accessing Services:**
    - **API Gateway**: `http://localhost:80`
    - **Auth Service**: `http://localhost:3001`
    - **PostgreSQL**: `localhost:5432`
    - **Redis**: `localhost:6379`

## Code Organization

- `/services`: Contains all individual microservices. Each service is a self-contained application.
- `/clients`: Contains frontend applications, including the `admin-panel` and the `user-client` project.
- `/infrastructure`: Holds Kubernetes manifests, Terraform scripts, and other deployment configurations.
- `/packages`: Shared Node.js packages used by multiple services (e.g., `api-types`).

---