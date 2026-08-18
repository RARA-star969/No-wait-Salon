# Vendored QR encoder

`qrcodegen.ts` is the TypeScript implementation from Project Nayuki's maintained
[QR Code generator library](https://github.com/nayuki/QR-Code-generator/tree/master/typescript-javascript),
retrieved on 2026-08-18. It retains the upstream MIT license header. The only local
adaptation is the final named export used by the Node/TypeScript backend.

The encoder is vendored so production QR preview and PNG download do not depend on
an external rendering service. Review upstream releases periodically and replace
the file from the same official source when updating it.
