import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await login({ email, password });
      navigate(ROUTES.welcome, { replace: true });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha no login.');
    }
  };

  return (
    <RoutePlaceholder title="Login" description="Formulario minimo para teste de autenticacao fake.">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.5rem', maxWidth: 320 }}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="login-password">Senha</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit">Entrar</button>
      </form>

      {error ? <p>{error}</p> : null}
      <p>
        Nao tem conta? <Link to={ROUTES.signup}>Criar conta</Link>
      </p>
    </RoutePlaceholder>
  );
}
