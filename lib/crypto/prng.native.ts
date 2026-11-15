// Native only: make sure crypto.getRandomValues exists before tweetnacl needs randomness,
// even if the app forgot to import the polyfill at startup (import order is not guaranteed).
import 'react-native-get-random-values';
