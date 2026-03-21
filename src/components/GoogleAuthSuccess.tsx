import { useEffect, useRef, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

export default function GoogleAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  
  // Usamos un ref para evitar que el useEffect se dispare dos veces en modo estricto
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const token = searchParams.get('token');

    if (!token) {
      Swal.fire('Error', 'No se recibió el token de acceso', 'error');
      navigate('/landing');
      return;
    }

    // Le pedimos al backend los datos del usuario usando el token que nos dio Google
    api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        // Logueamos al usuario en el contexto global
        login(res.data, token);
        
        // Mensaje de bienvenida (opcional)
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: '¡Ingreso exitoso con Google!',
          showConfirmButton: false,
          timer: 1800,
          background: '#ffffff',
          color: '#111827',
        });

        // Lo mandamos a la Home!
        navigate('/');
      })
      .catch((err) => {
        console.error('Error recuperando usuario de Google:', err);
        Swal.fire('Error', 'No se pudo verificar la cuenta de Google', 'error');
        navigate('/landing');
      });

  }, [searchParams, navigate, login]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f8f8f8]">
      <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-[#3483fa]"></div>
      <p className="text-[15px] font-black text-slate-700">Completando inicio de sesión...</p>
      <p className="mt-1 text-[13px] text-slate-500">Ya casi estamos...</p>
    </div>
  );
}