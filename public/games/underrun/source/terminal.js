
var terminal_text_ident = '&gt; ';
var terminal_text_title = '' +
	'深层突围\n' +
	'__ \n' +
	'创意、画面与程序：\n' +
	'DOMINIC SZABLEWSKI // PHOBOSLAB.ORG\n' +
	'__ \n' +
	'音乐：\n' +
	'ANDREAS LÖSCH // NO-FATE.NET\n' +
	'___ \n' +
	'系统版本： 13.20.18\n' +
	'CPU: PL(R) Q-COATL 7240 @ 12.6 THZ\n' +
	'内存： 108086391056891900 BYTES\n' +
	' \n' +
	'正在连接…';

var terminal_text_garbage = 
	'´A1e{∏éI9·NQ≥ÀΩ¸94CîyîR›kÈ¡˙ßT-;ûÅf^˛,¬›A∫Sã€«ÕÕ' +
	'1f@çX8ÎRjßf•ò√ã0êÃcÄ]Î≤moDÇ’ñ‰\\ˇ≠n=(s7É;';

var terminal_text_story = 
	'DATE: SEP. 13, 2718 - 13:32\n' +
	'检测到严重系统故障\n' +
	'正在分析…\n' +
	'____\n \n' +
	'错误代码： JS13K2018\n' +
	'状态：系统离线\n' +
	'原因：卫星通信异常，缓存耗尽\n' +
	'受影响系统：设施自动控制\n' +
	'受影响模块：机械智能、辐射防护、能源管理\n' +
	' \n' +
	'正在启动救援系统…\n' +
	'___' +
	'失败\n \n' +
	'正在尝试自动重启…\n' +
	'___' +
	'失败\n' +
	'_ \n \n' +
	'必须手动重启全部系统\n' +
	'_ \n' +
	'WASD / 方向键移动，鼠标瞄准，左键射击\n' +
	'点击开始行动\n ';

var terminal_text_outro = 
	'卫星连接全部恢复\n' +
	'正在连接…___' +
	'连接已建立\n' +
	'正在接收传输…___ \n' +
	
	'SENT: SEP. 13, 2018\n' +
	'RCVD: SEP. 13, 2718\n \n' +
	
	'感谢游玩 ❤_ \n' +
	'I HAVE PREVIOUSLY BEEN A PROUD SPONSOR OF THE JS13K\n' +
	'COMPETITION SINCE THE VERY FIRST ONE BACK IN 2012.\n' +
	'HOWEVER, THIS YEAR\'S COMPETITION WAS MY FIRST ONE\n' +
	'AS A PARTICIPANT AND IT HAS BEEN TREMENDOUS FUN!\n \n' +
	
	'I WANT TO THANK MY DEAR FRIEND ANDREAS LÖSCH OF\n' +
	'NO-FATE.NET FOR COMPOSING SOME AWESOME MUSIC ON\n' + 
	'SUCH SHORT NOTICE.\n \n' +

	'FURTHER THANKS GO OUT TO THE JS13K STAFF, THE\n' +
	'SONANT-X DEVELOPERS AND ALL OTHER PARTICIPANTS\n' +
	'IN THIS YEAR\'S JS13K. SEE YOU NEXT YEAR!\n \n' +
	'DOMINIC__' +
	'传输结束';

var terminal_text_buffer = [],
	terminal_state = 0,
	terminal_current_line,
	terminal_line_wait = 100,
	terminal_print_ident = true,
	terminal_timeout_id = 0,
	terminal_hide_timeout = 0;

terminal_text_garbage += terminal_text_garbage + terminal_text_garbage;

function terminal_show() {
	clearTimeout(terminal_hide_timeout);
	a.style.opacity = 1;
	a.style.display = 'block';
}

function terminal_hide() {
	a.style.opacity = 0;
	terminal_hide_timeout = setTimeout(function(){a.style.display = 'none'}, 1000);
}

function terminal_cancel() {
	clearTimeout(terminal_timeout_id);
}

function terminal_prepare_text(text) {
	return text.replace(/_/g, '\n'.repeat(10)).split('\n');
}

function terminal_write_text(lines, callback) {
	if (lines.length) {
		terminal_write_line(lines.shift(), terminal_write_text.bind(this, lines, callback));
	}
	else {
		callback && callback();
	}
}

function terminal_write_line(line, callback) {
	if (terminal_text_buffer.length > 20) {
		terminal_text_buffer.shift();
	}
	if (line) {
		audio_play(audio_sfx_terminal);
		terminal_text_buffer.push((terminal_print_ident ? terminal_text_ident : '') + line);
		a.innerHTML = '<div>'+terminal_text_buffer.join('&nbsp;</div><div>')+'<b>█</b></div>';
	}
	terminal_timeout_id = setTimeout(callback, terminal_line_wait);
}

function terminal_show_notice(notice, callback) {
	a.innerHTML = '';
	terminal_text_buffer = [];

	terminal_cancel();
	terminal_show();
	terminal_write_text(terminal_prepare_text(notice), function(){
		terminal_timeout_id = setTimeout(function(){
			terminal_hide();
			callback && callback();
		}, 2000);
	});
}

function terminal_run_intro(callback) {
	terminal_text_buffer = [];
	terminal_write_text(terminal_prepare_text(terminal_text_title), function(){
		terminal_timeout_id = setTimeout(function(){
			terminal_run_garbage(callback);
		}, 4000);
	});
}

function terminal_run_garbage(callback) {
	terminal_print_ident = false;
	terminal_line_wait = 16;

	var t = terminal_text_garbage,
		length = terminal_text_garbage.length;

	for (var i = 0; i < 64; i++) {
		var s = (_math.random()*length)|0;
		var e = (_math.random()*(length - s))|0;
		t += terminal_text_garbage.substr(s, e) + '\n';
	}
	t += ' \n \n';
	terminal_write_text(terminal_prepare_text(t), function(){
		terminal_timeout_id = setTimeout(function(){
			terminal_run_story(callback);
		}, 1500);
	});
}

function terminal_run_story(callback) {
	terminal_print_ident = true;
	terminal_line_wait = 100;
	terminal_write_text(terminal_prepare_text(terminal_text_story), callback);
}

function terminal_run_outro(callback) {
	c.style.opacity = 0.3;
	a.innerHTML = '';
	terminal_text_buffer = [];

	terminal_cancel();
	terminal_show();
	terminal_write_text(terminal_prepare_text(terminal_text_outro));
}
