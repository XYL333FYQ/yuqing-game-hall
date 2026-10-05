// Input processing

///////////
// Mouse
///////////

// Set a position on the map to try to navigate to
function settarget(e)
{
  // e.button (0=left, 1=wheel/middle, 2=right)
  // e.offsetX/Y (target relative)
  // e.pageX/Y (document relative)
  // e.screenX/Y (screen relative)
  // e.layerX/Y (original element relative - scaled)

  if (e.button!=0) return;

  // If game was completed, do nothing
  if (gs.state==STATECOMPLETE)
    return;

  var myx=Math.floor((e.clientX-e.target.getBoundingClientRect().left)/gs.scale)+gs.xoffset;
  var myy=Math.floor((e.clientY-e.target.getBoundingClientRect().top)/gs.scale)+gs.yoffset;
  //console.log(myx+", "+myy);

  gs.path=pathfinder(
    (Math.floor(gs.y/TILESIZE)*gs.width)+Math.floor(gs.x/TILESIZE), // Current pos
    (Math.floor(myy/TILESIZE)*gs.width)+Math.floor(myx/TILESIZE));  // Clicked pos
}

// Move the pointer position
function pointerpos(e)
{
  if (e.target==gs.scanvas)
  {
    gs.cursorx=e.offsetX-(TILESIZE/2);
    gs.cursory=e.offsetY-(TILESIZE/2);
  
    if (!gs.touch)
      gs.cursor=true;
  }
  else
    gs.cursor=false;
}
