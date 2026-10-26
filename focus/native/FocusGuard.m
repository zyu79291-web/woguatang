#import <Cocoa/Cocoa.h>

@interface FocusGuard : NSObject <NSApplicationDelegate>
@property NSStatusItem *item;
@property NSTimer *timer;
@property NSDate *blockedSince;
@property NSDate *lastSwitch;
@property NSURL *folder;
@end
@implementation FocusGuard
- (NSURL *)stateFile { return [self.folder URLByAppendingPathComponent:@"state.json"]; }
- (NSDictionary *)readState {
 NSData *data=[NSData dataWithContentsOfURL:[self stateFile]];
 if(!data)return @{@"enabled":@NO};
 id value=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
 return [value isKindOfClass:[NSDictionary class]]?value:@{@"enabled":@NO};
}
- (void)stop:(NSString *)reason {
 NSDictionary *state=@{@"enabled":@NO,@"expiresAt":@0,@"updatedAt":@([[NSDate date] timeIntervalSince1970]),@"reason":reason};
 NSData *data=[NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
 [data writeToURL:[self stateFile] options:NSDataWritingAtomic error:nil];
 self.blockedSince=nil;self.item.button.title=@"专注：关";
}
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
 self.folder=[[[NSBundle mainBundle].bundleURL URLByDeletingLastPathComponent] URLByDeletingLastPathComponent];
 self.folder=[self.folder URLByAppendingPathComponent:@"runtime/focus"];
 [[NSFileManager defaultManager] createDirectoryAtURL:self.folder withIntermediateDirectories:YES attributes:nil error:nil];
 [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
 self.item=[[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];self.item.button.title=@"专注：关";
 NSMenu *menu=[[NSMenu alloc]init];
 NSMenuItem *label=[[NSMenuItem alloc]initWithTitle:@"仅保留窝瓜汤 / ChatGPT / PTE 学姐" action:nil keyEquivalent:@""];label.enabled=NO;[menu addItem:label];[menu addItem:[NSMenuItem separatorItem]];
 NSMenuItem *end=[[NSMenuItem alloc]initWithTitle:@"结束专注，恢复正常使用" action:@selector(endFocus:) keyEquivalent:@""];end.target=self;[menu addItem:end];
 NSMenuItem *quit=[[NSMenuItem alloc]initWithTitle:@"退出专注组件" action:@selector(quitGuard:) keyEquivalent:@""];quit.target=self;[menu addItem:quit];self.item.menu=menu;
 [[[NSWorkspace sharedWorkspace] notificationCenter] addObserver:self selector:@selector(tick:) name:NSWorkspaceDidActivateApplicationNotification object:nil];
 self.lastSwitch=[NSDate distantPast];self.timer=[NSTimer scheduledTimerWithTimeInterval:0.35 target:self selector:@selector(tick:) userInfo:nil repeats:YES];
 [self tick:nil];
}
- (void)endFocus:(id)sender { [self stop:@"已手动结束专注"]; }
- (void)quitGuard:(id)sender { [self stop:@"专注组件已退出"];[NSApp terminate:nil]; }
- (void)applicationWillTerminate:(NSNotification *)notification { [self stop:@"专注组件已退出"]; }
- (void)tick:(id)sender {
 NSDate *now=[NSDate date];
 NSDictionary *ready=@{@"pid":@([[NSProcessInfo processInfo]processIdentifier]),@"updatedAt":@([now timeIntervalSince1970])};
 NSData *readyData=[NSJSONSerialization dataWithJSONObject:ready options:0 error:nil];
 [readyData writeToURL:[self.folder URLByAppendingPathComponent:@"helper.json"] options:NSDataWritingAtomic error:nil];
 NSDictionary *state=[self readState];
 if(![state[@"enabled"] boolValue]){self.item.button.title=@"专注：关";self.blockedSince=nil;return;}
 NSData *beatData=[NSData dataWithContentsOfURL:[self.folder URLByAppendingPathComponent:@"heartbeat.json"]];
 NSDictionary *beat=beatData?[NSJSONSerialization JSONObjectWithData:beatData options:0 error:nil]:nil;
 if(!beat||[now timeIntervalSince1970]-[beat[@"updatedAt"] doubleValue]>5){[self stop:@"连接已中断，专注自动结束"];return;}
 NSRunningApplication *chrome=[[NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.google.Chrome"] firstObject];
 if(!chrome||chrome.terminated){[self stop:@"Chrome 已退出，专注自动结束"];return;}
 self.item.button.title=@"专注中 · 可结束";
 NSRunningApplication *front=[NSWorkspace sharedWorkspace].frontmostApplication;
 if(!front)return;
 if([front.bundleIdentifier isEqualToString:@"com.google.Chrome"]||front.processIdentifier==[NSProcessInfo processInfo].processIdentifier){self.blockedSince=nil;return;}
 // System permission and lock-screen dialogs remain accessible.
 if(front.activationPolicy!=NSApplicationActivationPolicyRegular)return;
 if(!self.blockedSince)self.blockedSince=now;
 if([now timeIntervalSinceDate:self.blockedSince]>3){[self stop:@"macOS 未允许自动切回 Chrome，专注已结束"];return;}
 if([now timeIntervalSinceDate:self.lastSwitch]<0.35)return;self.lastSwitch=now;
 BOOL activated=[chrome activateWithOptions:NSApplicationActivateAllWindows|NSApplicationActivateIgnoringOtherApps];
 if(activated)[front hide];
}
@end
int main(int argc,const char *argv[]){@autoreleasepool{NSApplication *app=[NSApplication sharedApplication];FocusGuard *delegate=[[FocusGuard alloc]init];app.delegate=delegate;[app run];}return 0;}
