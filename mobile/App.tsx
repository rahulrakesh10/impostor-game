import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider } from './src/context/GameContext';
import { GameNavigator } from './src/GameNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <GameNavigator />
        <StatusBar style="dark" />
      </GameProvider>
    </SafeAreaProvider>
  );
}
