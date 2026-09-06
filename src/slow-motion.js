// Wall-clock ramp: normal to half speed (or back) takes half a second.
export class SlowMotion {
  constructor(){this.reset();}
  reset(){this.scale=1;}
  advance(seconds,held){
    const target=held ? .5 : 1,previous=this.scale;
    const rampSeconds=Math.min(seconds,Math.abs(target-previous));
    this.scale=previous+Math.sign(target-previous)*rampSeconds;
    // Integrate the ramp, including any time spent at its endpoint. This
    // keeps simulation time independent of the display's refresh rate.
    return (previous+this.scale)*.5*rampSeconds+target*(seconds-rampSeconds);
  }
}
