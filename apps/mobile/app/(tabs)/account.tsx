import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/auth';
import { ScreenBackground } from '../../components/ScreenBackground';
import { ScreenHeader } from '../../components/ScreenHeader';

export default function AccountScreen() {
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);

  if (session) {
    return (
      <ScreenBackground>
        <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Account" />
        <View className="flex-1 p-6">
        <View className="mt-8 items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-primary">
            <Ionicons name="person" size={36} color="#fff" />
          </View>
          <Text className="mt-3 text-xl font-extrabold text-brand-text">
            {session.user.email}
          </Text>
          <Text className="text-brand-muted">Signed in</Text>
        </View>
        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          className="mt-10 items-center rounded-2xl border border-brand-divider bg-white py-4 active:opacity-80"
        >
          <Text className="font-bold text-brand-primary">Sign out</Text>
        </Pressable>
        </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return <AuthForm />;
}

function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        Alert.alert(
          'Almost there',
          'Account created. If email confirmation is enabled, check your inbox before signing in.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
      <ScreenHeader title="Account" />
      <View className="flex-1 justify-center p-6">
      <Text className="text-2xl font-extrabold text-brand-text">
        {mode === 'signin' ? 'Welcome back' : 'Create account'}
      </Text>
      <Text className="mb-6 mt-1 text-brand-muted">
        {mode === 'signin' ? 'Sign in to track your orders.' : 'Sign up to save your orders.'}
      </Text>

      <Text className="mb-1 text-sm font-semibold text-brand-text">Email</Text>
      <TextInput
        className="mb-4 rounded-2xl border border-brand-divider bg-white px-4 py-3 text-brand-text"
        placeholder="you@example.com"
        placeholderTextColor="#6B6358"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text className="mb-1 text-sm font-semibold text-brand-text">Password</Text>
      <TextInput
        className="rounded-2xl border border-brand-divider bg-white px-4 py-3 text-brand-text"
        placeholder="••••••••"
        placeholderTextColor="#6B6358"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text className="mt-3 text-red-600">{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Sign up'}
        className="mt-6 items-center rounded-2xl bg-brand-primary py-4 active:opacity-80"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-bold text-white">{mode === 'signin' ? 'Sign in' : 'Sign up'}</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
          setError(null);
        }}
        className="mt-4 items-center"
      >
        <Text className="text-brand-muted">
          {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
        </Text>
      </Pressable>
      </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}
