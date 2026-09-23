import './style/app.css';
import { createGame } from './ui/app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app root not found');
}

createGame(root).start();
