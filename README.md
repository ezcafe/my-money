

## Getting started

### Setup HTTPS locally

#### Install mkcert tool
`brew install mkcert`

#### Setup mkcert on your machine (creates a CA)
`mkcert -install`

#### Create .cert directory if it doesn't exist
`mkdir -p .cert`

#### Generate the certificate (run from the root of this project)
`mkcert -key-file ./.cert/key.pem -cert-file ./.cert/cert.pem "localhost"`
