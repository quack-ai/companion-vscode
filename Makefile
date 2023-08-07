build:
	yarn
	yarn compile

run:
	yarn
	yarn watch

package:
	vsce package

style:
	yarn lint:fix
	yarn format:fix

quality:
	yarn lint:check
	yarn format:check
