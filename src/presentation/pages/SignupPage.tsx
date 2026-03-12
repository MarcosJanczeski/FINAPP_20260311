import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { RoutePlaceholder } from '../components/RoutePlaceholder';
import { useAuth } from '../hooks/useAuth';

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await signUp({ email, password });
      navigate(ROUTES.welcome, { replace: true });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha no cadastro.');
    }
  };

  return (
    <RoutePlaceholder title="Criar Conta" description="Formulario minimo para criar sessao local.">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.5rem', maxWidth: 320 }}>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="signup-password">Senha</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit">Criar conta</button>
      </form>

      {error ? <p>{error}</p> : null}
      <p>
        Ja possui conta? <Link to={ROUTES.login}>Entrar</Link>
      </p>
    </RoutePlaceholder>
  );
}
