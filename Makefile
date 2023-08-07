# Run it
run:
	yarn watch

# Compile it
build:
	yarn compile
	vsce package

style:
	yarn lint:fix
	yarn format:fix

quality:
	yarn lint:check
	yarn format:check
