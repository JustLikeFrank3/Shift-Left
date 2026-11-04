export const correctOrder = ['SOURCE','BUILD','TEST','STAGE','PROD'] as const;
export type Stage = typeof correctOrder[number];
export type Mission = { order: Stage[]; attempts: number; completed: boolean; running: boolean; feedback: string };
export function newMission(): Mission { return { order:['PROD','SOURCE','STAGE','BUILD','TEST'], attempts:0, completed:false, running:false, feedback:'Arrange the pipeline from source code to production.' }; }
export function moveStage(m: Mission, from: number, to: number): Mission {
  if(m.completed || m.running || from<0 || to<0 || from>=m.order.length || to>=m.order.length) return m;
  const order=[...m.order]; const [item]=order.splice(from,1); order.splice(to,0,item);
  return {...m,order,feedback:'Pipeline updated. Validate your order when ready.'};
}
export function validate(m: Mission): Mission {
  if(m.running || m.completed) return m;
  const attempts=m.attempts+1;
  const wrong=m.order.findIndex((s,i)=>s!==correctOrder[i]);
  if(wrong>=0) return {...m,attempts,feedback:`Not quite. ${m.order[wrong]} is in position ${wrong+1}. Think about what must happen before this stage.`};
  return {...m,attempts,running:true,feedback:'Pipeline validated! Running simulated deployment…'};
}
export function finish(m: Mission): Mission {
  return m.running ? {...m,running:false,completed:true,feedback:'Deployment succeeded! A passing pipeline is a start—not proof of security. Next mission: investigate a red build.'} : m;
}
