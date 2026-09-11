
function ControlsExplain(master) {
	const
		MENUCOLOR=PALETTE.BLACK,
		HELPX=HSCREEN_WIDTH,
		TIMEPERSCHEME=FPS*3,
		SPACING=QMATH.floor((FONT.tileHeight*1.3));
		
	var
		controlSchemes=[],currentScheme,timer,menu;

	this.initialize=function() {

		if (GAMECONTROLS.KEYBOARD)
			controlSchemes.push({
				label:"键盘",
				help:["移动 / 转向：WASD","开火：G　动作 / 瞄准：H　横移：F"]
			});

		if (GAMECONTROLS.KEYMOUSE)
			controlSchemes.push({
				label:"键盘 + 鼠标",
				help:["移动：WASD　瞄准：鼠标","开火：鼠标左键　动作：鼠标中键"]
			});

		if (GAMECONTROLS.TOUCH) {
			controlSchemes.push({
				label:"触摸屏",
				help:["左侧区域移动，右侧区域转向","点击屏幕按钮开火或互动"]
			});
			controlSchemes.push({
				label:"触摸屏",
				help:["左侧区域转向，右侧区域移动","点击屏幕按钮开火或互动"]
			});
		}

		controlSchemes.push({
			label:"多个手柄",
			help:["使用摇杆移动和转向","使用扳机开火，按键执行互动"]
		});

		menu=new KeyMenu({
			menuY:SCREEN_HEIGHT-QMATH.ceil(FONT.tileHeight*1.5),
			noGoBack:true
		});
		menu.setMenu({
			options:[
				{label:"明白了"}
			]
		})
	}
	this.show=function() {
		currentScheme=0;
		timer=0;
		TRANSITION.start();
		if (master.screenControls=="mouse")
			TRANSITION.notify("请先激活游戏","点击游戏画面即可开始操作")
		menu.reset();
	}
	this.frame=function() {				
		timer++;
		if (timer>=TIMEPERSCHEME) {
			timer=0;
			currentScheme=(currentScheme+1)%controlSchemes.length;
		}
		switch (menu.frame(TRANSITION.isFree)) {
			case MENU_CANCEL:
			case MENU_CONFIRM:{
				TRANSITION.end(-1);
				break;
			}
		}
		return TRANSITION.getState();
	}
	this.render=function(ctx) {
		var
			y=FONT.tileHeight;

		CANVAS.fillRect(ctx,MENUCOLOR,1,0,0,SCREEN_WIDTH, SCREEN_HEIGHT);
		CANVAS.printCenter(ctx,FONT,FONTPALETTE.BLUE,HELPX,y,"菜单始终可以使用以下按键操作");
		y+=SPACING;
		CANVAS.printCenter(ctx,FONT,FONTPALETTE.WHITE,HELPX,y,"方向键选择　回车确认　数字 1 返回");
		y+=SPACING*3;
		CANVAS.printCenter(ctx,FONT,FONTPALETTE.WHITE,HELPX,y,"也可以使用或自定义："+controlSchemes[currentScheme].label);
		y+=SPACING*2;

		controlSchemes[currentScheme].help.forEach(line=>{
			CANVAS.printCenter(ctx,FONT,FONTPALETTE.WHITE,HELPX,y,line);
			y+=SPACING*2;
		});

		menu.render(ctx);
		TRANSITION.render(ctx);
	}
}
