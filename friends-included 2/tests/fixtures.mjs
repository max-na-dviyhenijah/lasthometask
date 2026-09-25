export const sales=[
 ['S01','richard','Olivia Rose','A','1000','One proud uncle and an emotional grandmother',[50,30,20]],
 ['S02','anastasia','Daniel King','B','2000','University friends, dancing, and the stripping performance',[0,50,50]],
 ['S03','jean-claude','Emma Stonebridge','A','1500','Premium relatives, including an uncle presented as a surgeon',[40,40,20]],
 ['S04','richard','Lucas Green','B','800','Small group of loud university friends',[25,25,50]],
 ['S05','richard','Mia Brooks','B','600','Extra guests and an embarrassing speech',[100,0,0]]
].map(([reference,actor,customer,project,amount,description,split])=>({actor,input:{kind:'sale',reference,customer,project,amount,description,split}}));
export const expenses=[
 ['E01','120','Materials','A','Rented suit and fake pearl necklace for the relatives'],
 ['E02','80','Travel','B','Taxi for the grandmother; Kevin selected the wrong project'],
 ['E03','100','Other','overhead','Monthly company website subscription'],
 ['E04','250','Materials','B','Replacement costumes after an enthusiastic dance performance'],
 ['E05','90','Travel','A','Minibus for university friends; Kevin selected the wrong project again'],
 ['E06','60','Other','overhead','Company telephone subscription'],
 ['E07','140','Materials','A','Emergency replacement clothing; project allocation still needs checking']
].map(([reference,amount,category,allocation,description])=>({actor:'kevin',input:{kind:'expense',reference,amount,category,allocation,description}}));
export const decisions1=[['S01',{split:[50,30,20]}],['S02',{split:[20,40,40]}],['E01',{allocation:'A'}],['E02',{allocation:'A'}]];
export const decisions2=[['S03',{split:[20,30,50]}],['S04',{split:[25,25,50]}],['E04',{allocation:'B'}],['E05',{allocation:'B'}]];
