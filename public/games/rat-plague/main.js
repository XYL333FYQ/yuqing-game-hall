// JS 13k 2023 entry

// Global constants
const XMAX=320;
const YMAX=180;
const TILESIZE=16;
const TILESPERROW=12;
const BGCOLOUR="#80c768";
const BGCOLOURROOM="#8d9bb4";

const STATEPLAYING=0;
const STATECOMPLETE=1;

// Tile ids
const TILE_MUSROOM=29;
const TILE_CART=57;
const TILE_DOOR1=74;
const TILE_DOOR2=78;
const TILE_SIGN=83;
const TILE_DOOR3=85;
const TILE_DOOR4=86;
const TILE_DOOR5=87;
const TILE_DOOR6=89;
const TILE_DOOR7=90;
const TILE_DOOR8=91;
const TILE_COIN=93;
const TILE_HIVE=94;
const TILE_LADDER=103;
const TILE_BOMB=105;
const TILE_PICKAXE=115;
const TILE_FORK=116;
const TILE_KEY=117;
const TILE_BOW=118;
const TILE_ARROW=119;
const TILE_AXE=127;
const TILE_SPADE=128;
const TILE_SCITHE=129;
const TILE_BUCKET=130;
const TILE_BUCKETFULL=131;
const TILE_CURSOR=132;
const TILE_WIZARD=135;
const TILE_VILLAGER1=136;
const TILE_VILLAGER2=137;
const TILE_VILLAGER3=138;
const TILE_VILLAGER4=139;
const TILE_KNIGHT1=140;
const TILE_KNIGHT2=141;
const TILE_KNIGHT3=142;
const TILE_PLAYER=143;
const TILE_BLACKSMITH=144;
const TILE_GHOUL=145;
const TILE_CYCLOPS=146;
const TILE_CRAB=147;
const TILE_MONK=148;
const TILE_WOODMAN=149;
const TILE_BAT=150;
const TILE_GHOST=151;
const TILE_SPIDER=152;
const TILE_RAT=153;
const TILE_RAT2=154;
const TILE_CHEST=155;
const TILE_POTIONWHITE=156;
const TILE_POTIONGREEN=157;
const TILE_POTIONRED=158;
const TILE_POTIONBLUE=159;
const TILE_SWORD=160;
const TILE_CHESTOPEN=167;

// Game state
var gs={
  // animation frame of reference
  step:(1/60), // target step time @ 60 fps
  acc:0, // accumulated time since last frame
  lasttime:0, // time of last frame
  fps:0, // current FPS
  frametimes:[], // array of frame times

  // physics in pixels per frame @ 60fps
  gravity:0.05,
  terminalvelocity:10,
  friction:1,

  // Canvas
  canvas:null, // Tiles
  ctx:null,
  scanvas:null, // Sprites
  sctx:null,
  scale:1, // Changes when resizing window

  // Cursor
  cursor:false, // Should cursor be shown
  cursorx:0, // x position of cursor
  cursory:0, // y position of cursor
  touch:false, // touchscreen - hide mouse

  // Tilemap image
  tilemap:null,
  tilemapflip:null,

  // Main character
  x:0, // x position
  y:0, // y position
  vs:0, // vertical speed
  hs:0, // horizontal speed
  tileid:TILE_PLAYER, // current player tile
  flip:false, // if player is horizontally flipped
  path:[], // path player is following when moving
  coins:0, // coins collected
  keys:0, // keys collected
  potions:[], // potions collected
  dwell:0, // how long since an action occured
  health:100, // player health percentage

  // Level attributes
  level:-1, // Level number (0 based)
  width:0, // Width in tiles
  height:0, // height in tiles
  xoffset:0, // current view offset from left (horizontal scroll)
  yoffset:0, // current view offset from top (vertical scroll)
  signpost:"", // when not empty holds coordinates of signpost we're over

  // Tiles
  tiles:[], // copy of current level (to allow destruction)

  // Characters
  chars:[],
  anim:8, // time until next character animation frame

  // Particles
  particles:[], // an array of particles for explosion frage, footprint / jump dust

  // Game state
  state:STATEPLAYING // state machine, 0=playing, 1=complete
};

var origlevels={};

// Random number generator
function rng()
{
  return Math.random();
}

// Handle resize events
function playfieldsize()
{
  var height=window.innerHeight;
  var ratio=XMAX/YMAX;
  var width=Math.floor(height*ratio);
  var top=0;
  var left=Math.floor((window.innerWidth/2)-(width/2));

  if (width>window.innerWidth)
  {
    width=window.innerWidth;
    ratio=YMAX/XMAX;
    height=Math.floor(width*ratio);

    left=0;
    top=Math.floor((window.innerHeight/2)-(height/2));
  }
  
  gs.scale=(height/YMAX);

  // Tiles
  gs.canvas.style.top=top+"px";
  gs.canvas.style.left=left+"px";
  gs.canvas.style.transformOrigin='0 0';
  gs.canvas.style.transform='scale('+gs.scale+')';

  // Sprites
  gs.scanvas.style.top=top+"px";
  gs.scanvas.style.left=left+"px";
  gs.scanvas.style.transformOrigin='0 0';
  gs.scanvas.style.transform='scale('+gs.scale+')';
}

// Draw tile
function drawtile(tileid, x, y)
{
  // Don't draw tile 0 (background)
  if (tileid==0) return;

  // Clip to what's visible
  if (((x-gs.xoffset)<-TILESIZE) && // clip left
      ((x-gs.xoffset)>XMAX) && // clip right
      ((y-gs.yoffset)<-TILESIZE) && // clip top
      ((y-gs.yoffset)>YMAX))   // clip bottom
    return;

  gs.ctx.drawImage(gs.tilemap, (tileid*TILESIZE) % (TILESPERROW*TILESIZE), Math.floor((tileid*TILESIZE) / (TILESPERROW*TILESIZE))*TILESIZE, TILESIZE, TILESIZE, x-gs.xoffset, y-gs.yoffset, TILESIZE, TILESIZE);
}

// Draw sprite
function drawsprite(sprite)
{
  // Don't draw sprite 0 (background)
  if (sprite.id==0) return;

  // Clip to what's visible
  if (((Math.floor(sprite.x)-gs.xoffset)<-TILESIZE) && // clip left
      ((Math.floor(sprite.x)-gs.xoffset)>XMAX) && // clip right
      ((Math.floor(sprite.y)-gs.yoffset)<-TILESIZE) && // clip top
      ((Math.floor(sprite.y)-gs.yoffset)>YMAX))   // clip bottom
    return;

  if (sprite.flip)
    gs.sctx.drawImage(gs.tilemapflip, ((TILESPERROW*TILESIZE)-((sprite.id*TILESIZE) % (TILESPERROW*TILESIZE)))-TILESIZE, Math.floor((sprite.id*TILESIZE) / (TILESPERROW*TILESIZE))*TILESIZE, TILESIZE, TILESIZE,
      Math.floor(sprite.x)-gs.xoffset, Math.floor(sprite.y)-gs.yoffset, TILESIZE, TILESIZE);
  else
    gs.sctx.drawImage(gs.tilemap, (sprite.id*TILESIZE) % (TILESPERROW*TILESIZE), Math.floor((sprite.id*TILESIZE) / (TILESPERROW*TILESIZE))*TILESIZE, TILESIZE, TILESIZE,
      Math.floor(sprite.x)-gs.xoffset, Math.floor(sprite.y)-gs.yoffset, TILESIZE, TILESIZE);
}

// Draw single particle
function drawparticle(particle)
{
  var x=particle.x+(particle.t*Math.cos(particle.ang));
  var y=particle.y+(particle.t*Math.sin(particle.ang));

  // Clip to what's visible
    if (((Math.floor(x)-gs.xoffset)<0) && // clip left
    ((Math.floor(x)-gs.xoffset)>XMAX) && // clip right
    ((Math.floor(y)-gs.yoffset)<0) && // clip top
    ((Math.floor(y)-gs.yoffset)>YMAX))   // clip bottom
  return;

  gs.sctx.fillStyle="rgba("+particle.r+","+particle.g+","+particle.b+","+particle.a+")";
  gs.sctx.fillRect(Math.floor(x)-gs.xoffset, Math.floor(y)-gs.yoffset, particle.s, particle.s);
}

// Draw particles
function drawparticles()
{
  for (var i=0; i<gs.particles.length; i++)
    drawparticle(gs.particles[i]);
}

// Generate some particles around an origin
function generateparticles(cx, cy, mt, count, rgb)
{
  for (var i=0; i<count; i++)
  {
    var ang=(Math.floor(rng()*360)); // angle to eminate from
    var t=Math.floor(rng()*mt); // travel from centre
    var r=rgb.r||(rng()*255);
    var g=rgb.g||(rng()*255);
    var b=rgb.b||(rng()*255);

    gs.particles.push({x:cx, y:cy, ang:ang, t:t, r:r, g:g, b:b, a:1.0, s:(rng()<0.05)?2:1});
  }
}

// Do processing for particles
function particlecheck()
{
  var i=0;

  // Process particles
  for (i=0; i<gs.particles.length; i++)
  {
    // Move particle
    gs.particles[i].t+=0.5;
    gs.particles[i].y+=(gs.gravity*2);

    // Decay particle
    gs.particles[i].a-=0.007;
  }

  // Remove particles which have decayed
  i=gs.particles.length;
  while (i--)
  {
    if (gs.particles[i].a<=0)
      gs.particles.splice(i, 1);
  }
}

// Move character around
function updateMovements()
{
  var speed=1;

  // Countdown since an action
  if (gs.dwell>0)
    gs.dwell--;

  // Move main character if a path is set
  if (gs.path.length>0)
  {
    var nextx=Math.floor(gs.path[0]%gs.width)*TILESIZE;
    var nexty=Math.floor(gs.path[0]/gs.width)*TILESIZE;
    var deltax=Math.abs(nextx-gs.x);
    var deltay=Math.abs(nexty-gs.y);

    // Check if we have arrived at the current path node
    if ((deltax==0) && (deltay==0))
    {
      // We are here, so move on to next path node
      gs.path.shift();

      // Generate some "dust" as we move
      if (gs.level==0)
        generateparticles(gs.x+(TILESIZE/2), gs.y+TILESIZE, 1, 1, {r:1, g:170, b:1});
      else
        generateparticles(gs.x+(TILESIZE/2), gs.y+TILESIZE, 1, 1, {r:128, g:128, b:128});
    }
    else
    {
      // Move onwards, following path
      if (deltax!=0)
      {
        gs.flip=(nextx<gs.x);
        gs.hs=gs.flip?-speed:speed;
        gs.x+=gs.hs;

        if (gs.x<0)
          gs.x=0;
      }

      if (deltay!=0)
      {
        gs.y+=(nexty<gs.y)?-speed:speed;

        if (gs.y<0)
          gs.y=0;
      }
    }
  }

  // Check for particle usage
  particlecheck();
}

// Load level
function loadlevel(level)
{
  // Make sure it exists
  if ((level>=0) && (levels.length-1<level)) return;

  // Save current level back to maintain state
  if (gs.level!=-1)
    levels[gs.level].chars=JSON.parse(JSON.stringify(gs.chars));

  // Set current level to new one
  gs.level=level;

  // Deep copy tiles list to allow changes
  gs.tiles=JSON.parse(JSON.stringify(levels[gs.level].tiles));

  // Get width/height of new level
  gs.width=parseInt(levels[gs.level].width, 10);
  gs.height=parseInt(levels[gs.level].height, 10);

  // Populate chars (non solid tiles)
  if (levels[gs.level].minified==undefined)
  {
    gs.chars=[];

    for (var y=0; y<gs.height; y++)
    {
      for (var x=0; x<gs.width; x++)
      {
        var tile=parseInt(levels[gs.level].chars[(y*gs.width)+x]||0, 10);

        if (tile!=0)
        {
          var obj={id:(tile-1), x:(x*TILESIZE), y:(y*TILESIZE), sx:(x*TILESIZE), sy:(y*TILESIZE), flip:false, hs:0, vs:0, dwell:0, path:[], health:100, cure:0, del:false};

          switch (tile-1)
          {
            case TILE_PLAYER: // Player
              gs.x=obj.x; // Set current position
              gs.y=obj.y;

              levels[gs.level].sx=obj.x; // Set start position
              levels[gs.level].sy=obj.y;

              gs.vs=0; // Start not moving
              gs.hs=0;
              gs.flip=false;
              break;

            default:
              gs.chars.push(obj); // Everything else
              break;
          }
        }
      }
    }

    levels[gs.level].minified=true;
  }
  else
  {
    // Use cached copy of modified level
    gs.chars=levels[gs.level].chars;

    // Set up player
    gs.x=levels[gs.level].sx;
    gs.y=levels[gs.level].sy;
  }

  gs.path=[]; // Clear any path being followed
  gs.particles=[]; // Clear any leftover particles

  // Sort chars such sprites are at the end (so are drawn last, i.e on top)
  gs.chars.sort(sortChars);
}

// Draw level
function drawlevel()
{
  for (var y=0; y<gs.height; y++)
  {
    for (var x=0; x<gs.width; x++)
    {
      var tile=parseInt(gs.tiles[(y*gs.width)+x]||1, 10);
      drawtile(tile-1, x*TILESIZE, y*TILESIZE);
    }
  }
}

// Draw chars
function drawchars()
{
  for (var id=0; id<gs.chars.length; id++)
  {
    drawsprite(gs.chars[id]);

    // Draw health bar when hurt
    if (((gs.chars[id].health||0)>0) && (gs.chars[id].health<100))
    {
      gs.sctx.fillStyle="rgba(0,255,0,0.75)";
      gs.sctx.fillRect(gs.chars[id].x-gs.xoffset, gs.chars[id].y-gs.yoffset, Math.ceil(TILESIZE*(gs.chars[id].health/100)), 2);
      gs.sctx.stroke();
    }
  
    // If health is below 80% spout some blood
    if (((gs.chars[id].health||0)>0) && (gs.chars[id].health<80))
    {
      var blood={r:1, g:1, b:1};

      switch (gs.chars[id].blood||0)
      {
        case TILE_POTIONGREEN:
          blood.g=255;
          break;

        case TILE_POTIONRED:
          blood.r=255;
          break;

        case TILE_POTIONBLUE:
          blood.b=255;
          break;

        default:
          break;
      }

      generateparticles(gs.chars[id].x+(TILESIZE/2), gs.chars[id].y+TILESIZE, 1, 1, blood);
    }
  }
}

// Check for game being completed
function isgamecompleted()
{
  // This is defined as ..
  //   no closed treasure chests
  //   no coins
  //   no potions
  var count=0;

  for (var level=0; level<levels.length; level++)
  {
    // Don't count what's in the shop because some potions in there can't be collected
    if (level!=2)
      count+=countcharsonlevel([TILE_CHEST, TILE_COIN, TILE_POTIONBLUE, TILE_POTIONGREEN, TILE_POTIONRED, TILE_POTIONWHITE], level);
  }

  return (count==0);
}

// Scroll level to player
function scrolltoplayer(dampened)
{
  var xmiddle=Math.floor((XMAX-TILESIZE)/2);
  var ymiddle=Math.floor((YMAX-TILESIZE)/2);
  var maxxoffs=((gs.width*TILESIZE)-XMAX);
  var maxyoffs=((gs.height*TILESIZE)-YMAX);

  // Work out where x and y offsets should be
  var newxoffs=gs.x-xmiddle;
  var newyoffs=gs.y-ymiddle;

  if (newxoffs>maxxoffs) newxoffs=maxxoffs;
  if (newyoffs>maxyoffs) newyoffs=maxyoffs;

  if (newxoffs<0) newxoffs=0;
  if (newyoffs<0) newyoffs=0;

  // Determine if xoffset should be changed
  if (newxoffs!=gs.xoffset)
  {
    if (dampened)
    {
      var xdelta=1;

      if (Math.abs(gs.xoffset-newxoffs)>(XMAX/5)) xdelta=4;

      gs.xoffset+=newxoffs>gs.xoffset?xdelta:-xdelta;
    }
    else
      gs.xoffset=newxoffs;
  }

  // Determine if xoffset should be changed
  if (newyoffs!=gs.yoffset)
  {
    if (dampened)
    {
      var ydelta=1;

      if (Math.abs(gs.yoffset-newyoffs)>(YMAX/5)) ydelta=4;

      gs.yoffset+=newyoffs>gs.yoffset?ydelta:-ydelta;
    }
    else
      gs.yoffset=newyoffs;
  }
}

// https://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-using-html-canvas
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r)
{
  if (w<(2*r)) r=w/2;
  if (h<(2*r)) r=h/2;

  this.beginPath();
  this.moveTo(x+r, y);
  this.arcTo(x+w, y,   x+w, y+h, r);
  this.arcTo(x+w, y+h, x,   y+h, r);
  this.arcTo(x,   y+h, x,   y,   r);
  this.arcTo(x,   y,   x+w, y,   r);
  this.closePath();

  return this;
};

// Draw the statusbar
function drawstatusbar()
{
  var fontsize=1;
  var boxheight=0;
  var boxypos=0;

  // Display coin count when we have some
  if (gs.coins>0)
    boxheight+=TILESIZE;

  // Display key when collected
  if (gs.keys>0)
    boxheight+=TILESIZE;

  // Display potions when collected
  if (gs.potions.includes(TILE_POTIONWHITE)) boxheight+=TILESIZE;
  if (gs.potions.includes(TILE_POTIONGREEN)) boxheight+=TILESIZE;
  if (gs.potions.includes(TILE_POTIONRED)) boxheight+=TILESIZE;
  if (gs.potions.includes(TILE_POTIONBLUE)) boxheight+=TILESIZE;

  // Don't draw empty box
  if (boxheight==0) return;

  // Draw box
  gs.sctx.fillStyle="rgba(255,255,255,0.55)";
  gs.sctx.strokeStyle="rgba(0,0,0,0)";
  gs.sctx.roundRect(10, 10, (TILESIZE*2)+5, 5+boxheight, 5).fill();

  // Show how many coins have been collected
  if (gs.coins>0)
  {
    drawsprite({id:TILE_COIN, x:12+gs.xoffset, y:12+boxypos+gs.yoffset, flip:false});
    write(gs.sctx, 15+TILESIZE, 16+boxypos, ""+gs.coins, 1, "rgb(0,0,0)");

    boxypos+=TILESIZE;
  }

  // Show how many keys we've collected
  if (gs.keys>0)
  {
    drawsprite({id:TILE_KEY, x:12+gs.xoffset, y:12+boxypos+gs.yoffset, flip:false});

    if (gs.keys>1)
      write(gs.sctx, 15+TILESIZE, 16+boxypos, ""+gs.keys, 1, "rgb(0,0,0)");
  
    boxypos+=TILESIZE;
  }

  // Show which and how many of each potion we have
  if (gs.potions.length>0)
  {
    for (var potion of [TILE_POTIONWHITE, TILE_POTIONGREEN, TILE_POTIONRED, TILE_POTIONBLUE])
    {
      if (gs.potions.includes(potion))
      {
        const initialvalue=0;
        const potioncounter=gs.potions.reduce((accumulator, curpotion) => accumulator + (curpotion==potion?1:0), initialvalue);

        drawsprite({id:potion, x:12+gs.xoffset, y:12+boxypos+gs.yoffset, flip:false});

        if (potioncounter>1)
          write(gs.sctx, 15+TILESIZE, 16+boxypos, ""+potioncounter, 1, "rgb(0,0,0)");

        boxypos+=TILESIZE;
      }
    }    
  }
}

// Draw text from a sign
function drawsign()
{
  var fontsize=1;
  var i;
  var width=0;
  var height=0;
  var top=0;
  var icon=TILE_SIGN;
  const boxborder=1;

  // Find text for signpost
  for (i=0; i<signs.length; i++)
  {
    if (signs[i].loc==gs.signpost)
      break;
  }
  if (i==signs.length) // See if nothing found
    return;

  // Draw box
  // Split on \n
  const txtlines=(signs[i].txt).split("\n");

  // Determine width (length of longest string + border)
  for (i=0; i<txtlines.length; i++)
  {
    // Check for and remove icon from first line
    if ((i==0) && (txtlines[i].indexOf("[")==0))
    {
      var endbracket=txtlines[i].indexOf("]");
      if (endbracket!=-1)
      {
        icon=parseInt(txtlines[i].substring(1, endbracket), 10);
        txtlines[i]=txtlines[i].substring(endbracket+1);
      }
    }

    if (txtlines[i].length>width)
      width=txtlines[i].length;
  }

  width+=(boxborder*2);

  // Determine height (number of lines + border)
  height=txtlines.length+(boxborder*2);

  // Convert width/height into pixels
  width*=font_width;
  height*=(font_height+1);

  // Add space if sprite is to be drawn
  if (icon!=-1)
  {
    // Check for centering text when only one line and icon pads height
    if (txtlines.length==1)
      top=0.5;

    width+=(TILESIZE+(font_width*2));

    if (height<(TILESIZE+(2*font_height)))
      height=TILESIZE+(2*font_height);
  }

  // Draw box
  gs.sctx.fillStyle="rgba(255,255,255,0.75)";
  gs.sctx.strokeStyle="rgba(0,0,0,0)";
  gs.sctx.roundRect(XMAX-(width+(boxborder*font_width)), 1*font_height, width, height, font_width).fill();

    // Draw optional sprite
    if (icon!=-1)
      drawsprite({id:icon, x:(XMAX-width)+gs.xoffset, y:((boxborder*2)*font_height)+gs.yoffset, flip:false});

  // Draw text //
  for (i=0; i<txtlines.length; i++)
    write(gs.sctx, XMAX-width+(icon==-1?0:TILESIZE+font_width), (i+(boxborder*2)+top)*(font_height+1), txtlines[i], 1, "rgba(0,0,0,0.75)");
}

// Redraw the game world
function redraw()
{
  // Scroll to keep player in view
  scrolltoplayer(true);

  // Clear the tile canvas
  gs.ctx.fillStyle=(gs.level==0?BGCOLOUR:BGCOLOURROOM);
  gs.ctx.fillRect(0, 0, gs.canvas.width, gs.canvas.height);

  // Draw the level
  drawlevel();

  // Clear the sprites canvas
  gs.sctx.clearRect(0, 0, gs.scanvas.width, gs.scanvas.height);

  // Draw the chars
  drawchars();

  // Draw the player
  drawsprite({id:gs.tileid, x:gs.x, y:gs.y+((gs.x%TILESIZE)==8?1:0), flip:gs.flip});
  // Draw player health bar when hurt
  if (gs.health<100)
  {
    gs.sctx.fillStyle="rgba(0,255,0,0.75)";
    gs.sctx.fillRect(gs.x-gs.xoffset, gs.y-gs.yoffset, Math.ceil(TILESIZE*(gs.health/100)), 2);
    gs.sctx.stroke();
  }
 
  // Draw the particles
  drawparticles();

  // Draw the cursor
  if ((gs.cursor) && (!gs.touch))
    drawsprite({id:TILE_CURSOR, x:gs.cursorx+gs.xoffset, y:gs.cursory+gs.yoffset, flip:false});

  // Draw the statusbar
  drawstatusbar();

  // Draw sign if we're over one
  if (gs.signpost!="")
    drawsign();

  // Draw the room name
  if (gs.level>0)
  {
    var roomname=levels[gs.level].title;
    var fontsize=2;

    write(gs.sctx, (XMAX/2)-((roomname.length/2)*font_width*fontsize), 10, roomname, fontsize, "rgb(0,0,0)");
  }
}

// Check if area a overlaps with area b
function overlap(ax, ay, aw, ah, bx, by, bw, bh)
{
  // Check horizontally
  if ((ax<bx) && ((ax+aw))<=bx) return false; // a too far left of b
  if ((ax>bx) && ((bx+bw))<=ax) return false; // a too far right of b

  // Check vertically
  if ((ay<by) && ((ay+ah))<=by) return false; // a too far above b
  if ((ay>by) && ((by+bh))<=ay) return false; // a too far below b

  return true;
}

// Collision check with player hitbox
function checkcollide()
{
  // Generate player hitbox
  var px=gs.x+(TILESIZE/3);
  var py=gs.y+((TILESIZE/5)*2);
  var pw=(TILESIZE/3);
  var ph=(TILESIZE/5)*3;
  var id=0;
  var newitem={};

  gs.signpost="";

  // Iterate over all chars on the map
  for (id=0; id<gs.chars.length; id++)
  {
    // Check for collision with this char
    if (overlap(px, py, pw, ph, gs.chars[id].x, gs.chars[id].y, TILESIZE, TILESIZE))
    {
      switch (gs.chars[id].id)
      {
        case TILE_COIN:
          gs.chars[id].del=true; // Remove coin from map
          gs.coins++;
          break;

        case TILE_KEY:
          gs.chars[id].del=true; // Remove key from map
          gs.keys++;
          break;

        // For villagers who can be infected see if we can cure them when we collide
        case TILE_VILLAGER1:
        case TILE_VILLAGER2:
        case TILE_VILLAGER3:
        case TILE_VILLAGER4:
          if (((gs.chars[id].health||0)>0) && (gs.chars[id].health<80) && ((gs.chars[id].blood||0)>0))
          {
            // Try for an exact match first
            if (gs.potions.includes(gs.chars[id].blood))
            {
              gs.chars[id].health=100; // Put villager back to full health
              gs.potions.splice(gs.potions.indexOf(gs.chars[id].blood), 1); // Remove matching potion from list
            }
            else
            {
              // Try white potion
              if (gs.potions.includes(TILE_POTIONWHITE))
              {
                gs.chars[id].health=100; // Put villager back to full health
                gs.potions.splice(gs.potions.indexOf(TILE_POTIONWHITE), 1); // Remove white potion from list
              }
            }
          }
          break;

        case TILE_CYCLOPS:
        case TILE_BAT:
        case TILE_GHOST:
        case TILE_SPIDER:
          if (gs.health>0) gs.health--;
          break;

        case TILE_POTIONWHITE:
        case TILE_POTIONGREEN:
        case TILE_POTIONRED:
        case TILE_POTIONBLUE:
          if (gs.level==2)
          {
            // We're in the shop

            // Make sure we are at the end of a walk
            if (gs.path.length==0)
            {
              if (gs.chars[id].id==TILE_POTIONWHITE)
              {
                if (gs.coins>=5)
                {
                  if (gs.dwell==0)
                  {
                    gs.coins-=5;
                    gs.potions.push(gs.chars[id].id);
                  }
                }
                else
                  gs.signpost="-2,-2";
              }
              else
              {
                if (gs.coins>=2)
                {
                  if (gs.dwell==0)
                  {
                    gs.coins-=2;
                    gs.potions.push(gs.chars[id].id);
                  }
                }
                else
                  gs.signpost="-2,-2";
              }

              // Prevent all the money being spent on the same potion
              gs.dwell=3*60;
            }
          }
          else
          {
            gs.chars[id].del=true; // Remove potion from map
            gs.potions.push(gs.chars[id].id);
          }
          break;

        case TILE_LADDER:
          if (gs.path.length==0)
          {
            // Load the level corresponding to this ladder
            var laddername=""+Math.floor(gs.x/TILESIZE)+","+Math.floor(gs.y/TILESIZE);
            for (var ladderlevel=0; ladderlevel<levels.length; ladderlevel++)
            {
              if (levels[ladderlevel].ladder==laddername)
              {
                loadlevel(ladderlevel);
                break;
              }
            }

            // Quickly get player in view
            scrolltoplayer(false);
          }
          break;

        case TILE_DOOR1:
        case TILE_DOOR2:
        case TILE_DOOR3:
        case TILE_DOOR4:
        case TILE_DOOR5:
        case TILE_DOOR6:
        case TILE_DOOR7:
        case TILE_DOOR8:
          if (gs.path.length==0)
          {
            if (gs.level==0)
            {
              if ((gs.chars[id].open||false) || (gs.keys>0))
              {
                // If door was locked, unlock it
                if ((gs.chars[id].open||false)==false)
                {
                  // Unlock door
                  gs.chars[id].open=true;

                  // Remove the key we just used
                  gs.keys--;
                }

                // Remember where we were
                gs.doorx=gs.x;
                gs.doory=gs.y;

                // Load the level corresponding to this door
                var doorname=""+Math.floor(gs.x/TILESIZE)+","+Math.floor(gs.y/TILESIZE);
                for (var doorlevel=0; doorlevel<levels.length; doorlevel++)
                {
                  if (levels[doorlevel].door==doorname)
                  {
                    loadlevel(doorlevel);
                    break;
                  }
                }

                // Quickly get player in view
                scrolltoplayer(false);
              }
              else
                gs.signpost="-1,-1";
            }
            else
            {
              // Got back to main level
              loadlevel(0);

              // Reset player position to below door
              gs.x=gs.doorx;
              gs.y=gs.doory+TILESIZE;

              // Quickly get player in view
              scrolltoplayer(false);
            }
          }
          break;

        case TILE_SIGN:
          gs.signpost=""+Math.floor(gs.x/TILESIZE)+","+Math.floor(gs.y/TILESIZE);
          break;

        case TILE_CHEST:
          if (gs.path.length==0)
          {
            // Open the chest
            gs.chars[id].id=TILE_CHESTOPEN;

            // Duplicate chest object, change it to a reward
            newitem=JSON.parse(JSON.stringify(gs.chars[id]));

            // Randomise item spawned from chest
            var spawnitem=Math.floor(rng()*100);

            if (spawnitem<50)
              newitem.id=TILE_COIN;
            else if (spawnitem<60)
              newitem.id=TILE_KEY;
            else if (spawnitem<70)
              newitem.id=TILE_POTIONBLUE;
            else if (spawnitem<80)
              newitem.id=TILE_POTIONRED;
            else if (spawnitem<90)
              newitem.id=TILE_POTIONGREEN;
            else if (spawnitem<=100)
              newitem.id=TILE_POTIONWHITE;
  
            // Only spawn coins in the shop
            if (gs.level==2) newitem.id=TILE_COIN;
            
            // If below chest position is solid, spawn above, otherwise spawn below
            if (gs.tiles[((Math.floor(newitem.y/TILESIZE)+1)*gs.width)+Math.floor(newitem.x/TILESIZE)]||0!=0)
              newitem.y-=TILESIZE;
            else
              newitem.y+=TILESIZE;
  
            // Spawn reward into game
            gs.chars.push(newitem);

            // Draw rainbow particles
            generateparticles(gs.chars[id].x+(TILESIZE/2), gs.chars[id].y+(TILESIZE/2), 16, 64, {});
          }
          break;

        default:
          break;
      }
    }
  }
}

// Determine distance (Hypotenuse) between two lengths in 2D space (using Pythagoras)
function calcHypotenuse(a, b)
{
  return(Math.sqrt((a * a) + (b * b)));
}

// Find the nearst char of type included in tileids to given x, y point or -1
function findnearestchar(x, y, tileids)
{
  var closest=(gs.width*gs.height*TILESIZE);
  var charid=-1;
  var dist;

  for (var id=0; id<gs.chars.length; id++)
  {
    if (tileids.includes(gs.chars[id].id))
    {
      dist=calcHypotenuse(Math.abs(x-gs.chars[id].x), Math.abs(y-gs.chars[id].y));

      if (dist<closest)
      {
        charid=id;
        closest=dist;
      }
    }
  }

  return charid;
}

function countcharsonlevel(tileids, level)
{
  var found=0;
  var id=0;

  if (level==gs.level)
  {
    for (id=0; id<gs.chars.length; id++)
      if (tileids.includes(gs.chars[id].id))
        found++;
  }
  else
  {
    for (id=0; id<levels[level].chars.length; id++)
    {
      if (levels[level].minified==undefined)
      {
        if (tileids.includes((levels[level].chars[id]||0)-1))
          found++;
      }
      else
      {
        if (tileids.includes(levels[level].chars[id].id))
          found++;
      }
    }
  }

  return found;
}

function countchars(tileids)
{
  return countcharsonlevel(tileids, gs.level);
}

// Sort the chars so sprites are last (so they appear in front of non-solid tiles)
function sortChars(a, b)
{
  if (a.id!=b.id) // extra processing if they are different ids
  {
    var aspr=(((a.id>=135) && (a.id<=154)) || ((a.id>=156) && (a.id<=160))); // see if a is a sprite
    var bspr=(((b.id>=135) && (b.id<=154)) || ((b.id>=156) && (b.id<=160))); // see if b is a sprite

    if (aspr==bspr) return 0; // both sprites, so don't swap

    if (aspr)
      return 1; // sort a after b
    else
      return -1; // sort a before b
  }

  return 0; // same id
}

// Update movement and logic of characters
function updatecharAI()
{
  var id=0;
  var tid=-1; // Target id

  for (id=0; id<gs.chars.length; id++)
  {
    // Check if dwelling
    if (gs.chars[id].dwell>0)
    {
      gs.chars[id].dwell--;
      continue;
    }

    // Check for collision
    for (var id2=0; id2<gs.chars.length; id2++)
    {
      // Has a collision taken place between this and another character
      if (overlap(gs.chars[id].x, gs.chars[id].y, TILESIZE, TILESIZE, gs.chars[id2].x, gs.chars[id2].y, TILESIZE, TILESIZE))
      {
        // Determine what to do based on current character
        switch (gs.chars[id].id)
        {
          case TILE_RAT:
          case TILE_RAT2:
            if ([TILE_VILLAGER1, TILE_VILLAGER2, TILE_VILLAGER3, TILE_VILLAGER4].includes(gs.chars[id2].id))
            {
              if (gs.chars[id2].health>0)
              {
                // If health is dropping below 80% then assign random blood colour
                if ((gs.chars[id2].health==80) && (gs.chars[id2].blood==undefined))
                {
                  // Assign random blood colour
                  gs.chars[id2].blood=Math.floor(rng()*3)+TILE_POTIONGREEN;
                }

                gs.chars[id2].health--;

                // If they have run out of health turn them into a ghost
                if (gs.chars[id2].health==0)
                  gs.chars[id2].id=TILE_GHOUL;
              }
            }
            break;

          default:
            break;
        }
      }
    }

    // Check if moving
    if (gs.chars[id].path.length>0)
    {
      var nextx=Math.floor(gs.chars[id].path[0]%gs.width)*TILESIZE;
      var nexty=Math.floor(gs.chars[id].path[0]/gs.width)*TILESIZE;
      var deltax=Math.abs(nextx-gs.chars[id].x);
      var deltay=Math.abs(nexty-gs.chars[id].y);
      var nx, ny;

      // Check if we have arrived at the current path node
      if ((deltax==0) && (deltay==0))
      {
        // We are here, so move on to next path node
        gs.chars[id].path.shift();

        // Check for being at end of path
        if (gs.chars[id].path.length==0)
        {
          // Following a move, wait a bit here
          gs.chars[id].dwell=(2*60);
        }
      }
      else
      {
        var charspeed=1;

        // Move onwards, following path
        if (deltax!=0)
        {
          gs.chars[id].hs=(nextx<gs.chars[id].x)?-charspeed:charspeed;
          gs.chars[id].x+=gs.chars[id].hs;
          gs.chars[id].flip=(gs.chars[id].hs<0);

          if (gs.chars[id].x<0)
            gs.chars[id].x=0;
        }

        if (deltay!=0)
        {
          gs.chars[id].y+=(nexty<gs.chars[id].y)?-charspeed:charspeed;

          if (gs.chars[id].x<0)
            gs.chars[id].x=0;
        }
      }

      continue;
    }

    // For things which are not dwelling or moving, decide what to do next.
    switch (gs.chars[id].id)
    {
      case TILE_RAT:
      case TILE_RAT2:
        tid=findnearestchar(gs.chars[id].x, gs.chars[id].y, [TILE_VILLAGER1, TILE_VILLAGER2, TILE_VILLAGER3, TILE_VILLAGER4]);

        // If we found something, plot a route to it
        if (tid!=-1)
        {
          gs.chars[id].path=pathfinder(
            (Math.floor(gs.chars[id].y/TILESIZE)*gs.width)+Math.floor(gs.chars[id].x/TILESIZE)
            ,
            (Math.floor(gs.chars[tid].y/TILESIZE)*gs.width)+Math.floor(gs.chars[tid].x/TILESIZE)
            );
        }
        break;

      case TILE_GHOUL:
        // Pick somewhere random to go to around the church
        nx=Math.floor((21+(rng()*15))*TILESIZE);
        ny=Math.floor(( 0+(rng()*13))*TILESIZE);

        gs.chars[id].path=pathfinder(
          (Math.floor(gs.chars[id].y/TILESIZE)*gs.width)+Math.floor(gs.chars[id].x/TILESIZE)
          ,
          (Math.floor(ny/TILESIZE)*gs.width)+Math.floor(nx/TILESIZE)
          );
        break;

      // Characters who chase us when we are nearby
      case TILE_CYCLOPS:
      case TILE_BAT:
      case TILE_GHOST:
      case TILE_SPIDER:
        if (calcHypotenuse(Math.abs(gs.x-gs.chars[id].x), Math.abs(gs.y-gs.chars[id].y))<(5*TILESIZE))
        {
          gs.chars[id].path=pathfinder(
            (Math.floor(gs.chars[id].y/TILESIZE)*gs.width)+Math.floor(gs.chars[id].x/TILESIZE)
            ,
            (Math.floor(gs.y/TILESIZE)*gs.width)+Math.floor(gs.x/TILESIZE)
            );
        }
        break;

      // Characters who run away from us when we are nearby
      case TILE_CRAB:
      case TILE_MONK:
      case TILE_WOODMAN:
        if (calcHypotenuse(Math.abs(gs.x-gs.chars[id].x), Math.abs(gs.y-gs.chars[id].y))<(5*TILESIZE))
        {
          // Pick somewhere random to run away to
          nx=Math.floor(rng()*gs.width*TILESIZE);
          ny=Math.floor(rng()*gs.height*TILESIZE);

          gs.chars[id].path=pathfinder(
            (Math.floor(gs.chars[id].y/TILESIZE)*gs.width)+Math.floor(gs.chars[id].x/TILESIZE)
            ,
            (Math.floor(ny/TILESIZE)*gs.width)+Math.floor(nx/TILESIZE)
            );
        }
        break;

      case TILE_VILLAGER1: // Beekeeper
      case TILE_VILLAGER2:
      case TILE_VILLAGER3:
      case TILE_VILLAGER4:
        // If there is a threat nearby, run away, otherwise stay home
        tid=findnearestchar(gs.chars[id].x, gs.chars[id].y, [TILE_RAT, TILE_RAT2]);
        if (tid!=-1)
        {
          if (calcHypotenuse(Math.abs(gs.chars[tid].x-gs.chars[id].x), Math.abs(gs.chars[tid].y-gs.chars[id].y))<(5*TILESIZE))
          {
            // Pick somewhere random to run away to
            nx=Math.floor(rng()*gs.width*TILESIZE);
            ny=Math.floor(rng()*gs.height*TILESIZE);

            gs.chars[id].path=pathfinder(
              (Math.floor(gs.chars[id].y/TILESIZE)*gs.width)+Math.floor(gs.chars[id].x/TILESIZE)
              ,
              (Math.floor(ny/TILESIZE)*gs.width)+Math.floor(nx/TILESIZE)
              );
          }
          else
          {
            // Go back to level start position
            gs.chars[id].path=pathfinder(
              (Math.floor(gs.chars[id].y/TILESIZE)*gs.width)+Math.floor(gs.chars[id].x/TILESIZE)
              ,
              (Math.floor(gs.chars[id].sy/TILESIZE)*gs.width)+Math.floor(gs.chars[id].sx/TILESIZE)
              );
          }
        }
        break;
        
      default:
        break;
    }
  }

  // Remove anything marked for deletion
  id=gs.chars.length;
  while (id--)
  {
    if (gs.chars[id].del)
      gs.chars.splice(id, 1);
  }
}

// Run an update step to the game state
function update()
{
  // Move player
  updateMovements();

  // Update the AI of all the characters
  updatecharAI();

  // Check for player collision
  checkcollide();

  // Check for game being completed
  if (isgamecompleted())
    gs.state=STATECOMPLETE; // Stop playing
}

function rafcallback(timestamp)
{
  // First time round, just save epoch
  if (gs.lasttime>0)
  {
    // Determine accumulated time since last call
    gs.acc+=((timestamp-gs.lasttime) / 1000);

    // If it's more than 15 seconds since last call, reset
    if ((gs.acc>gs.step) && ((gs.acc/gs.step)>(60*15)))
      gs.acc=gs.step*2;

    // Process "steps" since last call
    while (gs.acc>gs.step)
    {
      update();
      gs.acc-=gs.step;
    }

    redraw();

    // If we're done then draw congrats message
    if (gs.state==STATECOMPLETE)
    {
      gs.signpost="-3,-3";

      drawsign();
    }

    // If the update took us out of play state then stop now
    if (gs.state!=STATEPLAYING)
      return;
  }

  // Remember when we were last called
  gs.lasttime=timestamp;

  window.requestAnimationFrame(rafcallback);
}

// New level
function newlevel(level)
{
  if ((level<0) || (level>=levels.length))
    return;

    loadlevel(level);

    // Start frame callbacks
    window.requestAnimationFrame(rafcallback);
}

// Entry point
function init()
{
  // Initialise stuff
  document.onkeydown=function(e)
  {
    e = e || window.event;
    e.preventDefault();
  };

  // Stop things from being dragged around
  window.ondragstart=function(e)
  {
    e = e || window.event;
    e.preventDefault();
  };

  // Set up tiles canvas
  gs.canvas=document.getElementById("tiles");
  gs.ctx=gs.canvas.getContext("2d");

  // Set up sprites canvas
  gs.scanvas=document.getElementById("sprites");
  gs.sctx=gs.scanvas.getContext("2d");

  gs.scanvas.onmousedown=function(e)
  {
    e = e || window.event;
    settarget(e);
  };

  // Mouse pointer events
  window.addEventListener("mousemove", (e) => { pointerpos(e); } );
  window.addEventListener("mouseout", function() { gs.cursor=false; });

  // Touchscreen events
  window.addEventListener("touchstart", function() { gs.touch=true; });
  window.addEventListener("touchend", function() { gs.touch=true; });
  window.addEventListener("touchcancel", function() { gs.touch=true; });
  window.addEventListener("touchmove", function() { gs.touch=true; });

  window.addEventListener("resize", function() { playfieldsize(); });

  playfieldsize();

  // Make a deep copy of the levels as they were before changes
  origlevels=JSON.parse(JSON.stringify(levels));

  // Load tilemap
  gs.tilemap=new Image;
  gs.tilemap.onload=function()
  {
    // Create a horizontally flipped version of the spritesheet
    // https://stackoverflow.com/questions/21610321/javascript-horizontally-flip-an-image-object-and-save-it-into-a-new-image-objec
    var c=document.createElement('canvas');
    var ctx=c.getContext('2d');
    c.width=gs.tilemap.width;
    c.height=gs.tilemap.height;
    ctx.scale(-1, 1);
    ctx.drawImage(gs.tilemap, -gs.tilemap.width, 0);

    gs.tilemapflip=new Image;
    gs.tilemapflip.onload=function()
    {
      newlevel(0);
    };
    gs.tilemapflip.src=c.toDataURL();
  };
  gs.tilemap.src=tilemap;
}

// Run the init() once page has loaded
window.onload=function() { init(); };
