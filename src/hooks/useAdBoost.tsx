import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Hook para simular likes automáticos em anúncios
export const useAdBoost = (adId: string, isActive: boolean) => {
  useEffect(() => {
    if (!isActive) return;

    // Intervalo aleatório entre 30 segundos e 2 minutos
    const getRandomInterval = () => Math.floor(Math.random() * (120000 - 30000) + 30000);
    
    // Quantidade aleatória de likes a adicionar (1-3 por vez)
    const getRandomLikes = () => Math.floor(Math.random() * 3) + 1;

    let timeoutId: ReturnType<typeof setTimeout>;

    const addBoostLikes = async () => {
      try {
        // Verificar likes atuais
        const { data: currentLikes, error: fetchError } = await supabase
          .from('ad_likes')
          .select('id')
          .eq('ad_id', adId);

        if (fetchError) throw fetchError;

        const currentCount = currentLikes?.length || 0;
        
        // Limite máximo de 800 likes
        if (currentCount >= 800) {
          return;
        }

        // Adicionar likes aleatórios usando IDs fictícios
        const likesToAdd = Math.min(getRandomLikes(), 800 - currentCount);
        
        for (let i = 0; i < likesToAdd; i++) {
          // Usar UUID aleatório para simular diferentes usuários
          const fakeUserId = crypto.randomUUID();
          
          await supabase
            .from('ad_likes')
            .insert({
              ad_id: adId,
              user_id: fakeUserId,
            })
            .select()
            .single();
        }

        // Agendar próximo boost
        timeoutId = setTimeout(addBoostLikes, getRandomInterval());
      } catch (error) {
        console.error('Erro ao adicionar boost likes:', error);
        // Tentar novamente após 1 minuto em caso de erro
        timeoutId = setTimeout(addBoostLikes, 60000);
      }
    };

    // Iniciar o processo após um delay inicial
    const initialDelay = Math.floor(Math.random() * 10000) + 5000; // 5-15 segundos
    timeoutId = setTimeout(addBoostLikes, initialDelay);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [adId, isActive]);
};
