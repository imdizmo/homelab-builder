.PHONY: help setup up down test lint build clean

help:
	@echo "Available commands:"
	@echo "  make setup    - Start all services"
	@echo "  make up       - Start Docker Compose services"
	@echo "  make down     - Stop Docker Compose services"
	@echo "  make test     - Run tests"
	@echo "  make lint     - Run linters"
	@echo "  make build    - Build the application"
	@echo "  make clean    - Clean up containers and volumes"

setup:
	docker compose up -d

up:
	docker compose up -d

down:
	docker compose down

test:
	@echo "Running tests..."
	# Add test commands here

lint:
	@echo "Running linters..."
	# Add lint commands here

build:
	@echo "Building application..."
	# Add build commands here

clean:
	docker compose down -v